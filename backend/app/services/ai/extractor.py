from __future__ import annotations

import json
import logging
import os
import time
import urllib.error
import urllib.request
from typing import Any, Mapping, TypeVar

from pydantic import ValidationError

from app.api.v1.schemas.job import StructuredJobDescription
from app.api.v1.schemas.resume import StructuredResume


_T = TypeVar("_T", StructuredResume, StructuredJobDescription)
_logger = logging.getLogger(__name__)


def extract_structured_resume(raw_text: str) -> StructuredResume:
    return extract_structured_resume_with_meta(raw_text)[0]


def extract_structured_resume_with_meta(raw_text: str) -> tuple[StructuredResume, dict[str, Any]]:
    return _extract_with_meta(
        raw_text=raw_text,
        model_cls=StructuredResume,
        extraction_target="resume",
    )


def extract_structured_job(raw_text: str) -> StructuredJobDescription:
    return extract_structured_job_with_meta(raw_text)[0]


def extract_structured_job_with_meta(raw_text: str) -> tuple[StructuredJobDescription, dict[str, Any]]:
    return _extract_with_meta(
        raw_text=raw_text,
        model_cls=StructuredJobDescription,
        extraction_target="job_description",
    )


def _extract_with_meta(raw_text: str, model_cls: type[_T], extraction_target: str) -> tuple[_T, dict[str, Any]]:
    if not isinstance(raw_text, str) or not raw_text.strip():
        raise ValueError("raw_text must be a non-empty string")

    raw_text = raw_text[:12000]

    schema = model_cls.model_json_schema()
    system_prompt = _system_prompt(schema=schema, extraction_target=extraction_target)
    json_retry_prompt = _json_retry_prompt(schema=schema, extraction_target=extraction_target)

    failures: list[str] = []

    for model in _get_groq_models():
        meta: dict[str, Any] = {
            "target": extraction_target,
            "model_used": model,
            "attempts": 0,
            "latency_ms": [],
            "stages": [],
        }
        _logger.info("model_attempt model=%s target=%s", model, extraction_target)
        try:
            content, latency_ms = _chat_completion(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": raw_text},
                ],
                model=model,
            )
            meta["attempts"] = int(meta["attempts"]) + 1
            meta["latency_ms"].append(latency_ms)
        except ValueError as e:
            _logger.warning("model_failure model=%s target=%s stage=http detail=%s", model, extraction_target, e)
            failures.append(f"{model}:http:{e}")
            continue

        try:
            parsed = _parse_json_object(content)
            meta["stages"].append("json_parse")
        except ValueError as e:
            _logger.warning("model_failure model=%s target=%s stage=json_parse detail=%s", model, extraction_target, e)
            failures.append(f"{model}:json_parse:{e}")
            try:
                content_retry, latency_ms_retry = _chat_completion(
                    messages=[
                        {"role": "system", "content": json_retry_prompt},
                        {"role": "user", "content": raw_text},
                    ],
                    model=model,
                )
                parsed = _parse_json_object(content_retry)
                meta["attempts"] = int(meta["attempts"]) + 1
                meta["latency_ms"].append(latency_ms_retry)
                meta["stages"].append("json_parse_retry")
            except ValueError as e2:
                _logger.warning(
                    "model_failure model=%s target=%s stage=json_parse_retry detail=%s",
                    model,
                    extraction_target,
                    e2,
                )
                failures.append(f"{model}:json_parse_retry:{e2}")
                continue

        try:
            validated = model_cls.model_validate(parsed)
            _logger.info(
                "model_success model=%s target=%s attempts=%s latency_ms=%s",
                model,
                extraction_target,
                meta["attempts"],
                sum(meta["latency_ms"]) if meta["latency_ms"] else 0,
            )
            meta["validated"] = True
            return validated, meta
        except ValidationError as e:
            _logger.warning("model_failure model=%s target=%s stage=validation detail=%s", model, extraction_target, e)
            failures.append(f"{model}:validation:{e}")
            correction_prompt = _correction_prompt(schema=schema, extraction_target=extraction_target, error=str(e))
            try:
                content_retry, latency_ms_retry = _chat_completion(
                    messages=[
                        {"role": "system", "content": correction_prompt},
                        {"role": "user", "content": raw_text},
                    ],
                    model=model,
                )
                parsed_retry = _parse_json_object(content_retry)
                validated_retry = model_cls.model_validate(parsed_retry)
                meta["attempts"] = int(meta["attempts"]) + 1
                meta["latency_ms"].append(latency_ms_retry)
                meta["stages"].append("validation_retry")
                _logger.info(
                    "model_success model=%s target=%s attempts=%s latency_ms=%s",
                    model,
                    extraction_target,
                    meta["attempts"],
                    sum(meta["latency_ms"]) if meta["latency_ms"] else 0,
                )
                meta["validated"] = True
                return validated_retry, meta
            except (ValueError, ValidationError) as e2:
                _logger.warning(
                    "model_failure model=%s target=%s stage=validation_retry detail=%s",
                    model,
                    extraction_target,
                    e2,
                )
                failures.append(f"{model}:validation_retry:{e2}")
                continue

    if failures:
        unique: list[str] = []
        seen: set[str] = set()
        for item in failures:
            if item in seen:
                continue
            seen.add(item)
            unique.append(item)
        detail = " | ".join(unique[:6])
        if len(unique) > 6:
            detail = f"{detail} | (+{len(unique) - 6} more)"
        raise ValueError(f"All Groq models failed: {detail}")

    raise ValueError("All Groq models failed")


def _get_groq_models() -> list[str]:
    raw = os.getenv("GROQ_MODELS", "")
    if isinstance(raw, str) and raw.strip():
        models = [m.strip() for m in raw.split(",") if m.strip()]
        if models:
            return models
    return [
        "llama-3.1-70b-versatile",
        "llama-3.1-8b-instant",
        "mixtral-8x7b-32768",
    ]


def _chat_completion(messages: list[dict[str, str]], model: str, *, timeout_s: int = 45) -> tuple[str, int]:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError("GROQ_API_KEY is required")

    endpoint = "https://api.groq.com/openai/v1/chat/completions"

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "nefera-ai/0.1",
    }

    payload: dict[str, Any] = {
        "model": model,
        "temperature": 0,
        "max_tokens": 1200,
        "messages": messages,
        "response_format": {"type": "json_object"},
    }

    req = urllib.request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )

    try:
        body, latency_ms = _do_request_with_retry(req, timeout_s=timeout_s)
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")
        if e.code == 400 and ("response_format" in detail or "json_object" in detail or "response format" in detail):
            payload.pop("response_format", None)
            req2 = urllib.request.Request(
                endpoint,
                data=json.dumps(payload).encode("utf-8"),
                headers=headers,
                method="POST",
            )
            try:
                body, latency_ms = _do_request_with_retry(req2, timeout_s=timeout_s)
            except urllib.error.HTTPError as e2:
                detail2 = e2.read().decode("utf-8", errors="replace")
                raise ValueError(f"HTTP {e2.code}: {detail2}") from None
            except urllib.error.URLError as e2:
                raise ValueError(f"connection error: {e2.reason}") from None
        else:
            raise ValueError(f"HTTP {e.code}: {detail}") from None
    except urllib.error.URLError as e:
        raise ValueError(f"connection error: {e.reason}") from None

    try:
        data = json.loads(body)
        content = data["choices"][0]["message"]["content"]
    except Exception as e:
        raise ValueError(f"invalid response format: {e}") from None

    if not isinstance(content, str) or not content.strip():
        raise ValueError("empty content")

    return content, latency_ms


def generate_candidate_summary(
    resume: StructuredResume,
    job: StructuredJobDescription,
    total_score: float,
) -> dict[str, Any]:
    def _canon(s: str) -> str:
        return "".join(" ".join(str(s).strip().split()).casefold().split())

    resume_skills = {_canon(s) for s in resume.skills}
    resume_skills.discard("")
    required = [(raw, _canon(raw)) for raw in job.required_skills]
    required = [(raw, c) for raw, c in required if c]

    matched_required = [raw for raw, c in required if c in resume_skills]
    missing_required = [raw for raw, c in required if c not in resume_skills]

    strengths: list[str] = []
    gaps: list[str] = []

    if required:
        strengths.append(f"Matched {len(matched_required)}/{len(required)} required skills.")
        if missing_required:
            gaps.append("Missing required skills: " + ", ".join(missing_required[:8]) + ("" if len(missing_required) <= 8 else ", …"))

    exp_min = float(job.minimum_years_experience)
    exp_have = float(resume.total_years_experience)
    if exp_min <= 0:
        strengths.append("No minimum experience requirement.")
    elif exp_have >= exp_min:
        strengths.append(f"Meets experience requirement ({exp_have:g}y vs {exp_min:g}y).")
    else:
        gaps.append(f"Experience below requirement ({exp_have:g}y vs {exp_min:g}y).")

    if job.required_education is None:
        strengths.append("No required education constraint.")
    else:
        req_ed = job.required_education.casefold()
        ed_ok = any(req_ed in e.casefold() for e in resume.education)
        if ed_ok:
            strengths.append(f"Meets education requirement ({job.required_education}).")
        else:
            gaps.append(f"Education requirement not evidenced ({job.required_education}).")

    if job.domain is None:
        strengths.append("No domain constraint.")
    else:
        dom_ok = any(job.domain.casefold() == d.casefold() for d in resume.domains)
        if dom_ok:
            strengths.append(f"Domain match: {job.domain}.")
        else:
            gaps.append(f"Domain match not evidenced ({job.domain}).")

    if resume.projects:
        strengths.append("Has projects listed.")
    else:
        gaps.append("No projects detected.")

    strengths = strengths[:8]
    gaps = gaps[:8]

    base_reco = (
        "Proceed to interview scheduling."
        if total_score >= 80
        else "Route to recruiter review for validation."
        if total_score >= 60
        else "Recommend rejection based on current evidence."
    )

    schema = {
        "type": "object",
        "additionalProperties": False,
        "properties": {"recommendation": {"type": "string"}},
        "required": ["recommendation"],
    }
    system = (
        "You write concise hiring recommendations.\n"
        "Return a single JSON object only.\n"
        "Do not add extra keys.\n"
        f"JSON Schema:\n{json.dumps(schema, ensure_ascii=False)}\n"
    )
    user = json.dumps(
        {
            "total_score_0_to_100": float(total_score),
            "strengths": strengths,
            "gaps": gaps,
            "fallback_recommendation": base_reco,
        },
        ensure_ascii=False,
    )

    for model in _get_groq_models():
        _logger.info("model_attempt model=%s target=%s", model, "summary_recommendation")
        try:
            content, latency_ms = _chat_completion(
                messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
                model=model,
                timeout_s=18,
            )
            parsed = _parse_json_object(content)
            reco = parsed.get("recommendation")
            if not isinstance(reco, str) or not reco.strip():
                raise ValueError("recommendation schema mismatch")
            _logger.info("model_success model=%s target=%s latency_ms=%s", model, "summary_recommendation", latency_ms)
            return {"strengths": strengths, "gaps": gaps, "recommendation": reco.strip()}
        except ValueError as e:
            _logger.warning("model_failure model=%s target=%s detail=%s", model, "summary_recommendation", e)
            continue

    return {"strengths": strengths, "gaps": gaps, "recommendation": base_reco}


def _system_prompt(schema: Mapping[str, Any], extraction_target: str) -> str:
    schema_json = json.dumps(schema, ensure_ascii=False)
    return (
        "You are a strict information extraction engine for an AI hiring evaluation system.\n"
        f"Extract structured factual data for: {extraction_target}.\n"
        "Rules:\n"
        "- Output MUST be a single JSON object, with no surrounding text.\n"
        "- Output MUST match the provided JSON Schema exactly.\n"
        "- Extract ONLY facts present in the input text. Do not infer, guess, or hallucinate.\n"
        "- If a field is missing, use an empty list [] for list fields, and null for optional fields.\n"
        "- Use concise normalized strings; do not add commentary.\n"
        f"JSON Schema:\n{schema_json}\n"
    )


def _json_retry_prompt(schema: Mapping[str, Any], extraction_target: str) -> str:
    schema_json = json.dumps(schema, ensure_ascii=False)
    return (
        "You are a strict information extraction engine.\n"
        f"Extract structured factual data for: {extraction_target}.\n"
        "Rules:\n"
        "- Output MUST be a single JSON object, with no surrounding text.\n"
        "- Output MUST be valid JSON.\n"
        "- Output MUST match the provided JSON Schema exactly.\n"
        "- Extract ONLY facts present in the input text. Do not infer, guess, or hallucinate.\n"
        "- If a field is missing, use an empty list [] for list fields, and null for optional fields.\n"
        f"JSON Schema:\n{schema_json}\n"
    )


def _correction_prompt(schema: Mapping[str, Any], extraction_target: str, error: str) -> str:
    schema_json = json.dumps(schema, ensure_ascii=False)
    return (
        "You are a strict JSON repair and extraction engine.\n"
        f"The previous output for {extraction_target} did not validate.\n"
        "Fix the output so it matches the JSON Schema exactly.\n"
        "Rules:\n"
        "- Output MUST be a single JSON object, with no surrounding text.\n"
        "- Output MUST be valid JSON.\n"
        "- Do not hallucinate. Use only facts present in the input.\n"
        "- If missing, use [] for list fields and null for optional fields.\n"
        f"Validation error:\n{error}\n"
        f"JSON Schema:\n{schema_json}\n"
    )


def _parse_json_object(content: str) -> dict[str, Any]:
    if not isinstance(content, str):
        raise ValueError("LLM output is not a string")

    text = content.strip()
    if text.startswith("```"):
        lines = [line for line in text.splitlines() if not line.strip().startswith("```")]
        text = "\n".join(lines).strip()

    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("LLM output did not contain a JSON object")

    candidate = text[start : end + 1]
    try:
        parsed = json.loads(candidate)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON from LLM: {e}") from None

    if not isinstance(parsed, dict):
        raise ValueError("LLM output JSON must be an object")

    return parsed


def _do_request_with_retry(req: urllib.request.Request, *, timeout_s: int) -> tuple[str, int]:
    transient_http = {429, 500, 502, 503, 504}
    last_err: Exception | None = None
    for attempt in range(2):
        try:
            return _do_request(req, timeout_s=timeout_s)
        except urllib.error.HTTPError as e:
            last_err = e
            if e.code not in transient_http or attempt == 1:
                raise
            time.sleep(0.4 * (attempt + 1))
            continue
        except urllib.error.URLError as e:
            last_err = e
            if attempt == 1:
                raise
            time.sleep(0.4 * (attempt + 1))
            continue
    if last_err:
        raise last_err
    raise ValueError("request failed")


def _do_request(req: urllib.request.Request, *, timeout_s: int) -> tuple[str, int]:
    start = time.perf_counter()
    with urllib.request.urlopen(req, timeout=timeout_s) as resp:
        body = resp.read().decode("utf-8")
    latency_ms = int((time.perf_counter() - start) * 1000)
    return body, latency_ms
