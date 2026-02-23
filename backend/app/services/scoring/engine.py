from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping

from app.api.v1.schemas.job import StructuredJobDescription
from app.api.v1.schemas.resume import StructuredResume


@dataclass(frozen=True)
class ScoreResult:
    total_score: float
    breakdown: dict[str, Any]


def score_candidate(
    resume: StructuredResume,
    job: StructuredJobDescription,
    rubric: Mapping[str, Any],
) -> ScoreResult:
    """
    Deterministic weighted scoring engine.

    - Pure function: no I/O, no external calls, no randomness, no time usage.
    - Inputs are canonical structured schemas (resume/job) plus a rubric dictionary.
    - Output is a 0–100 score with a per-dimension breakdown.
    """

    # Rubric validation:
    # - All weights must be >= 0
    # - Sum of weights must be > 0
    # - Weights are normalized to sum to 1.0 for stable, predictable scoring
    weights = _extract_weights(rubric)

    # 1) Required Skills:
    # - Exact token match (case-insensitive)
    # - score = matched_required / total_required
    # - if no required skills -> 1.0
    required_skills_coverage = _required_skills_coverage(
        resume_skills=resume.skills,
        required_skills=job.required_skills,
    )
    required_skills_score = required_skills_coverage["ratio_0_to_1"]

    # 2) Experience:
    # - if resume >= minimum -> 1.0
    # - else resume/minimum (capped at 1.0)
    # - if minimum == 0 -> 1.0
    experience_score = _score_experience(
        total_years_experience=float(resume.total_years_experience),
        minimum_years_experience=float(job.minimum_years_experience),
    )

    # 3) Domain Match:
    # - case-insensitive exact match between job.domain and resume.domains
    # - if job.domain is None -> 1.0
    domain_match_score = _score_domain_match(
        resume_domains=resume.domains,
        job_domain=job.domain,
    )

    # 4) Projects:
    # - if at least 1 project exists -> 1.0
    # - else 0.0
    projects_score = 1.0 if len(resume.projects) > 0 else 0.0

    # 5) Education:
    # - if required_education is None -> 1.0
    # - else case-insensitive substring match against resume.education entries
    education_score = _score_education(
        resume_education=resume.education,
        required_education=job.required_education,
    )

    dimension_scores: dict[str, float] = {}
    dimension_scores["required_skills"] = required_skills_score
    dimension_scores["experience"] = experience_score
    dimension_scores["domain_match"] = domain_match_score
    dimension_scores["projects"] = projects_score
    dimension_scores["education"] = education_score

    # Final score:
    # total_score = sum(weight * dimension_score) * 100
    # Rounded to 2 decimals to ensure consistent outputs.
    weighted_sum_0_to_1 = 0.0
    breakdown: dict[str, Any] = {"dimensions": {}, "weights": weights.copy()}
    breakdown["required_skills_coverage"] = required_skills_coverage.copy()

    for dimension in ("required_skills", "experience", "domain_match", "projects", "education"):
        score_0_to_1 = _clamp01(dimension_scores.get(dimension, 0.0))
        w = weights.get(dimension, 0.0)
        contribution_0_to_1 = w * score_0_to_1
        weighted_sum_0_to_1 += contribution_0_to_1

        breakdown["dimensions"][dimension] = {
            "score_0_to_1": score_0_to_1,
            "weight_0_to_1": w,
            "contribution_0_to_100": contribution_0_to_1 * 100.0,
        }

    total_score = round(_clamp(weighted_sum_0_to_1 * 100.0, 0.0, 100.0), 2)
    breakdown["total_score_0_to_100"] = total_score

    return ScoreResult(total_score=total_score, breakdown=breakdown)


def _extract_weights(rubric: Mapping[str, Any]) -> dict[str, float]:
    """
    Accepts either:
      - {"weights": {"required_skills": 0.5, ...}}
      - {"required_skills": 0.5, ...}

    Weights are normalized to sum to 1.0 to make scoring stable and predictable.
    """

    raw: Any = rubric.get("weights", rubric)
    if not isinstance(raw, Mapping):
        raise ValueError("rubric weights must be a mapping")

    expected = ["required_skills", "experience", "domain_match", "projects", "education"]
    weights: dict[str, float] = {}

    total = 0.0
    for key in expected:
        value = raw.get(key, 0.0)
        try:
            w = float(value)
        except (TypeError, ValueError):
            raise ValueError(f"rubric weight for '{key}' must be a number") from None
        if w < 0:
            raise ValueError(f"rubric weight for '{key}' must be >= 0")
        weights[key] = w
        total += w

    if total <= 0:
        raise ValueError("rubric weights must sum to a positive number")

    for key in expected:
        weights[key] = weights[key] / total

    return weights


def _score_required_skills(resume_skills: list[str], required_skills: list[str]) -> float:
    """
    Required Skills = percentage of required skills matched.

    Matching is case-insensitive and based on exact normalized tokens.
    """

    if len(required_skills) == 0:
        return 1.0

    # Exact token match (case-insensitive) after normalization:
    # - collapse whitespace
    # - casefold for consistent case-insensitive matching
    resume_set = _normalized_set(resume_skills)
    required_set = _normalized_set(required_skills)

    if len(required_set) == 0:
        return 1.0

    matched = len(resume_set.intersection(required_set))
    return _clamp01(matched / len(required_set))


def _required_skills_coverage(resume_skills: list[str], required_skills: list[str]) -> dict[str, Any]:
    required_items: list[tuple[str, str]] = []
    for raw in required_skills:
        canon = _canon_skill(raw)
        if canon:
            required_items.append((raw, canon))

    if len(required_items) == 0:
        return {"matched": 0, "total": 0, "ratio_0_to_1": 1.0, "matched_required": [], "missing_required": []}

    resume_canon_set = {_canon_skill(s) for s in resume_skills}
    resume_canon_set.discard("")

    matched_required: list[str] = []
    missing_required: list[str] = []
    for raw, req in required_items:
        if _skill_in_set(req, resume_canon_set):
            matched_required.append(raw)
        else:
            missing_required.append(raw)

    total = len(required_items)
    matched = len(matched_required)
    return {
        "matched": matched,
        "total": total,
        "ratio_0_to_1": _clamp01(matched / total) if total else 1.0,
        "matched_required": matched_required,
        "missing_required": missing_required,
    }


def _score_experience(total_years_experience: float, minimum_years_experience: float) -> float:
    """
    Experience:
      - If resume >= minimum -> full score
      - Else proportional score (resume / minimum)
    """

    if minimum_years_experience <= 0:
        return 1.0
    if total_years_experience >= minimum_years_experience:
        return 1.0
    if total_years_experience <= 0:
        return 0.0
    return _clamp01(total_years_experience / minimum_years_experience)


def _score_domain_match(resume_domains: list[str], job_domain: str | None) -> float:
    """
    Domain Match:
      - If job.domain is None -> full score (no domain constraint)
      - If job.domain appears in resume.domains -> full score
      - Else 0
    """

    if job_domain is None:
        return 1.0

    jd = _norm_token(job_domain)
    if not jd:
        return 1.0

    resume_set = _normalized_set(resume_domains)
    return 1.0 if jd in resume_set else 0.0


def _score_education(resume_education: list[str], required_education: str | None) -> float:
    """
    Education:
      - If required_education is None -> full score
      - Else if required_education appears in any education entry -> full score
      - Else 0
    """

    if required_education is None:
        return 1.0

    req = _norm_token(required_education)
    if not req:
        return 1.0

    # Case-insensitive substring match against each education entry.
    req_cf = req.casefold()
    for entry in resume_education:
        entry_norm = _norm_token(entry)
        if entry_norm and req_cf in entry_norm.casefold():
            return 1.0

    return 0.0


def _norm_token(value: str) -> str:
    return " ".join(value.strip().split()).casefold()


def _normalized_set(values: list[str]) -> set[str]:
    out: set[str] = set()
    for v in values:
        n = _norm_token(v)
        if n:
            out.add(n)
    return out


_SKILL_SYNONYMS: dict[str, str] = {
    "py": "python",
    "python": "python",
    "js": "javascript",
    "javascript": "javascript",
    "ts": "typescript",
    "typescript": "typescript",
    "node": "nodejs",
    "nodejs": "nodejs",
    "node.js": "nodejs",
    "reactjs": "react",
    "react.js": "react",
    "react": "react",
    "next": "nextjs",
    "nextjs": "nextjs",
    "next.js": "nextjs",
    "postgres": "postgresql",
    "postgresql": "postgresql",
    "postgre": "postgresql",
    "k8s": "kubernetes",
    "kubernetes": "kubernetes",
    "c++": "cpp",
    "cpp": "cpp",
    "c#": "csharp",
    "csharp": "csharp",
    ".net": "dotnet",
    "dotnet": "dotnet",
    "golang": "go",
    "go": "go",
}


def _canon_skill(value: str) -> str:
    s = _norm_token(value)
    if not s:
        return ""
    s = s.replace("/", " ").replace("-", " ").replace("_", " ")
    s = " ".join(s.split())
    s = _SKILL_SYNONYMS.get(s, s)
    s = s.replace(" ", "")
    return _SKILL_SYNONYMS.get(s, s)


def _skill_in_set(required: str, resume_set: set[str]) -> bool:
    if required in resume_set:
        return True

    if len(required) < 4:
        return False

    for r in resume_set:
        if not r:
            continue
        if required in r or r in required:
            return True
    return False


def _clamp01(x: float) -> float:
    return 0.0 if x < 0.0 else 1.0 if x > 1.0 else x


def _clamp(x: float, lo: float, hi: float) -> float:
    return lo if x < lo else hi if x > hi else x
