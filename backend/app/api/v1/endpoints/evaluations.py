from __future__ import annotations

import json
import logging
import re
import time
from pathlib import Path
from typing import Any

import fitz
from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import ValidationError

from app.api.v1.schemas.job import StructuredJobDescription
from app.api.v1.schemas.resume import StructuredResume
from app.services.ai.extractor import extract_structured_job_with_meta, extract_structured_resume_with_meta
from app.services.orchestrator import run_evaluation


router = APIRouter(tags=["evaluations"])

_MAX_FILE_BYTES = 5 * 1024 * 1024
_logger = logging.getLogger(__name__)
_ws_multi_re = re.compile(r"[ \t\u00a0]+")
_nl_multi_re = re.compile(r"(?:\r?\n){3,}")
_page_num_re = re.compile(r"^\s*(page\s*)?\d+\s*(/|\sof\s)\s*\d+\s*$", flags=re.IGNORECASE)


@router.post("/evaluations/run")
async def run_evaluation_from_pdfs(
    resume_file: UploadFile = File(...),
    job_file: UploadFile = File(...),
) -> dict[str, Any]:
    started = time.perf_counter()
    resume_bytes = await _read_pdf_bytes(resume_file, "resume_file")
    job_bytes = await _read_pdf_bytes(job_file, "job_file")

    try:
        pdf_started = time.perf_counter()
        resume_text = _extract_pdf_text(resume_bytes)
        job_text = _extract_pdf_text(job_bytes)
        pdf_ms = int((time.perf_counter() - pdf_started) * 1000)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF extraction failure: {e}") from None

    resume_fallback_used = False
    job_fallback_used = False
    resume_meta: dict[str, Any] = {}
    job_meta: dict[str, Any] = {}

    try:
        resume_extract_started = time.perf_counter()
        resume_structured, resume_meta = extract_structured_resume_with_meta(resume_text)
        resume_extract_ms = int((time.perf_counter() - resume_extract_started) * 1000)
    except Exception as e:
        resume_fallback_used = True
        resume_meta = {"error": str(e)}
        try:
            resume_extract_started = time.perf_counter()
            resume_structured = _heuristic_extract_resume(resume_text)
            resume_extract_ms = int((time.perf_counter() - resume_extract_started) * 1000)
        except Exception as e2:
            raise HTTPException(status_code=400, detail=f"Resume extraction failed: {e2}") from None

    try:
        job_extract_started = time.perf_counter()
        job_structured, job_meta = extract_structured_job_with_meta(job_text)
        job_extract_ms = int((time.perf_counter() - job_extract_started) * 1000)
    except Exception as e:
        job_fallback_used = True
        job_meta = {"error": str(e)}
        try:
            job_extract_started = time.perf_counter()
            job_structured = _heuristic_extract_job(job_text)
            job_extract_ms = int((time.perf_counter() - job_extract_started) * 1000)
        except Exception as e2:
            raise HTTPException(status_code=400, detail=f"Job extraction failed: {e2}") from None

    try:
        inferred_job_domain = job_structured.domain or _infer_domain(job_text)
        if inferred_job_domain and inferred_job_domain != job_structured.domain:
            job_structured = job_structured.model_copy(update={"domain": inferred_job_domain})

        inferred_resume_domain = _infer_domain(resume_text)
        if inferred_resume_domain:
            existing = {d.casefold() for d in resume_structured.domains}
            if inferred_resume_domain.casefold() not in existing:
                resume_structured = resume_structured.model_copy(
                    update={"domains": [*resume_structured.domains, inferred_resume_domain]}
                )
    except Exception:
        pass

    rubric = _load_rubric_v1()

    try:
        evaluation_started = time.perf_counter()
        result = run_evaluation(
            resume_structured,
            job_structured,
            rubric,
            context={
                "resume_text": resume_text,
                "job_text": job_text,
                "extraction": {
                    "resume_fallback_used": resume_fallback_used,
                    "job_fallback_used": job_fallback_used,
                    "resume_meta": resume_meta,
                    "job_meta": job_meta,
                },
            },
        )
        evaluation_ms = int((time.perf_counter() - evaluation_started) * 1000)
        elapsed_ms = int((time.perf_counter() - started) * 1000)
        _logger.info(
            "evaluation_complete elapsed_ms=%s pdf_ms=%s resume_extract_ms=%s job_extract_ms=%s evaluation_ms=%s decision=%s",
            elapsed_ms,
            pdf_ms,
            resume_extract_ms,
            job_extract_ms,
            evaluation_ms,
            result.get("decision"),
        )
        return result
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=f"Validation error: {e}") from None
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from None
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Evaluation failure: {e}") from None


async def _read_pdf_bytes(file: UploadFile, field_name: str) -> bytes:
    filename = (file.filename or "").lower()
    if not filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail=f"Invalid file type for {field_name}: only .pdf allowed")

    content_type = (file.content_type or "").lower()
    if content_type and content_type not in {"application/pdf", "application/x-pdf"}:
        raise HTTPException(status_code=400, detail=f"Invalid file type for {field_name}: only PDF allowed")

    data = await file.read()
    if len(data) > _MAX_FILE_BYTES:
        raise HTTPException(status_code=400, detail=f"{field_name} exceeds 5MB limit")

    return data


def _extract_pdf_text(data: bytes) -> str:
    doc = fitz.open(stream=data, filetype="pdf")
    try:
        pages: list[list[str]] = []
        for page in doc:
            raw = page.get_text("text") or ""
            lines = [ln.strip() for ln in raw.splitlines()]
            lines = [ln for ln in lines if ln]
            pages.append(lines)

        header_counts: dict[str, int] = {}
        footer_counts: dict[str, int] = {}
        for lines in pages:
            if not lines:
                continue
            header_counts[lines[0]] = header_counts.get(lines[0], 0) + 1
            footer_counts[lines[-1]] = footer_counts.get(lines[-1], 0) + 1

        header_candidate = max(header_counts, key=header_counts.get) if header_counts else None
        footer_candidate = max(footer_counts, key=footer_counts.get) if footer_counts else None

        cleaned_pages: list[str] = []
        for lines in pages:
            if not lines:
                cleaned_pages.append("")
                continue

            if (
                header_candidate
                and header_counts.get(header_candidate, 0) >= 2
                and lines
                and lines[0] == header_candidate
            ):
                lines = lines[1:]

            if (
                footer_candidate
                and footer_counts.get(footer_candidate, 0) >= 2
                and lines
                and lines[-1] == footer_candidate
            ):
                lines = lines[:-1]

            if lines and _page_num_re.match(lines[-1]):
                lines = lines[:-1]

            cleaned_pages.append("\n".join(lines))

        return _normalize_whitespace("\n".join(cleaned_pages))
    finally:
        doc.close()


def _load_rubric_v1() -> dict[str, Any]:
    rubric_path = Path(__file__).resolve().parents[3] / "services" / "scoring" / "rubrics" / "v1.json"
    try:
        return json.loads(rubric_path.read_text(encoding="utf-8"))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load rubric: {e}") from None


def _normalize_whitespace(text: str) -> str:
    text = _ws_multi_re.sub(" ", text)
    text = _nl_multi_re.sub("\n\n", text)
    return text.strip()


_KNOWN_SKILLS: tuple[str, ...] = (
    "python",
    "java",
    "javascript",
    "typescript",
    "react",
    "nextjs",
    "nodejs",
    "fastapi",
    "django",
    "flask",
    "sql",
    "postgresql",
    "mysql",
    "mongodb",
    "redis",
    "aws",
    "azure",
    "gcp",
    "docker",
    "kubernetes",
    "git",
    "linux",
)


def _infer_domain(text: str) -> str | None:
    t = (text or "").casefold()
    buckets: dict[str, tuple[str, ...]] = {
        "fintech": ("fintech", "payment", "payments", "bank", "banking", "credit", "lending", "wallet", "kyc", "aml"),
        "healthcare": ("healthcare", "hospital", "clinical", "patient", "hipaa", "ehr", "emr"),
        "ecommerce": ("ecommerce", "e-commerce", "shop", "checkout", "cart", "order", "retail", "marketplace", "shopify"),
        "saas": ("saas", "b2b", "subscription", "multi-tenant", "tenant", "crm", "erp"),
        "data": ("data", "analytics", "etl", "warehouse", "bigquery", "snowflake", "databricks", "pipeline"),
        "ml_ai": ("machine learning", "ml", "llm", "nlp", "computer vision", "rag", "prompt"),
    }

    best = None
    best_score = 0
    for domain, kws in buckets.items():
        score = 0
        for kw in kws:
            if kw in t:
                score += 1
        if score > best_score:
            best = domain
            best_score = score
    return best if best_score > 0 else None


def _scan_skills(text: str) -> list[str]:
    t = (text or "").casefold()
    skills: list[str] = []
    for s in _KNOWN_SKILLS:
        token = s
        if token == "nextjs" and ("next.js" in t or "nextjs" in t):
            skills.append("Next.js")
            continue
        if token == "nodejs" and ("node.js" in t or "nodejs" in t):
            skills.append("Node.js")
            continue
        if token == "gcp" and ("gcp" in t or "google cloud" in t):
            skills.append("GCP")
            continue
        if token == "aws" and ("aws" in t or "amazon web services" in t):
            skills.append("AWS")
            continue
        if token == "postgresql" and ("postgres" in t or "postgresql" in t):
            skills.append("PostgreSQL")
            continue
        if token in t:
            skills.append(token.upper() if token in {"sql"} else token.title())
    seen: set[str] = set()
    out: list[str] = []
    for s in skills:
        key = s.casefold()
        if key in seen:
            continue
        seen.add(key)
        out.append(s)
    return out


def _heuristic_extract_resume(text: str) -> StructuredResume:
    lines = [ln.strip() for ln in (text or "").splitlines() if ln.strip()]
    name = None
    if lines:
        candidate = lines[0]
        if 2 <= len(candidate) <= 80 and any(ch.isalpha() for ch in candidate) and "@" not in candidate:
            name = candidate

    years = 0.0
    for m in re.finditer(r"(\d+(?:\.\d+)?)\+?\s+years", (text or ""), flags=re.IGNORECASE):
        try:
            years = max(years, float(m.group(1)))
        except ValueError:
            continue
    if years > 50:
        years = 50.0

    domain = _infer_domain(text)
    skills = _scan_skills(text)
    education: list[str] = []
    t = (text or "").casefold()
    if "bachelor" in t or "b.tech" in t or "btech" in t or "b.sc" in t:
        education.append("Bachelor")
    if "master" in t or "m.tech" in t or "mtech" in t or "m.sc" in t:
        education.append("Master")
    if "phd" in t or "doctorate" in t:
        education.append("PhD")

    return StructuredResume(
        full_name=name or "Candidate",
        total_years_experience=years,
        skills=skills,
        education=education,
        domains=[domain] if domain else [],
        projects=[],
        companies=[],
    )


def _heuristic_extract_job(text: str) -> StructuredJobDescription:
    t = (text or "").casefold()
    skills = _scan_skills(text)

    min_years = 0.0
    for m in re.finditer(r"(\d+(?:\.\d+)?)\+?\s+years", (text or ""), flags=re.IGNORECASE):
        start = max(0, m.start() - 40)
        window = (text or "")[start : m.end() + 40].casefold()
        if "experience" in window or "years" in window:
            try:
                min_years = max(min_years, float(m.group(1)))
            except ValueError:
                continue
    if min_years > 40:
        min_years = 40.0

    required_education = None
    if "bachelor" in t or "b.tech" in t or "btech" in t:
        required_education = "Bachelor"
    if "master" in t or "m.tech" in t or "mtech" in t:
        required_education = "Master"

    domain = _infer_domain(text)

    required_skills = skills if skills else []
    if not required_skills:
        raise ValueError("Unable to infer required_skills from job description text")

    return StructuredJobDescription(
        domain=domain,
        required_skills=required_skills,
        preferred_skills=[],
        minimum_years_experience=min_years,
        required_education=required_education,
    )
