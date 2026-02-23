from __future__ import annotations

import logging
import time
from typing import Any, Mapping

from app.api.v1.schemas.job import StructuredJobDescription
from app.api.v1.schemas.resume import StructuredResume
from app.services.decision import DecisionOutcome, decide
from app.services.integration import send_mock_email
from app.services.ai.extractor import generate_candidate_summary
from app.services.scoring.engine import ScoreResult, score_candidate


_logger = logging.getLogger(__name__)


def run_evaluation(
    resume_structured: StructuredResume,
    job_structured: StructuredJobDescription,
    rubric: Mapping[str, Any],
    context: Mapping[str, Any] | None = None,
) -> dict:
    """
    Agent Orchestrator: runs the evaluation workflow end-to-end.

    Constraints:
    - No DB calls.
    - No LLM calls.
    - Deterministic except the integration side effect.
    """

    # 1) Validate inputs (relies on canonical structured schemas upstream).
    if rubric is None:
        raise ValueError("rubric must be provided")

    # 2) Call scoring engine (pure deterministic function).
    scoring_started = time.perf_counter()
    score_result: ScoreResult = score_candidate(
        resume=resume_structured,
        job=job_structured,
        rubric=rubric,
    )
    scoring_ms = int((time.perf_counter() - scoring_started) * 1000)

    confidence_score = _compute_confidence(score_result=score_result, context=context)
    total_score = _apply_boosts(score_result=score_result, context=context)

    summary: dict[str, Any] | None = None
    summary_started = time.perf_counter()
    try:
        summary = generate_candidate_summary(resume=resume_structured, job=job_structured, total_score=total_score)
    except Exception:
        summary = None
    summary_ms = int((time.perf_counter() - summary_started) * 1000)

    decision_started = time.perf_counter()
    decision_result = decide(total_score=total_score, rubric=rubric, confidence_score=confidence_score)
    decision_ms = int((time.perf_counter() - decision_started) * 1000)

    _logger.info(
        "evaluation_timing scoring_ms=%s summary_ms=%s decision_ms=%s",
        scoring_ms,
        summary_ms,
        decision_ms,
    )

    # 4) Trigger action based on decision (only side effect in this workflow).
    action_triggered = False
    action_type: str | None = None

    if decision_result.decision_outcome == DecisionOutcome.AUTO_ADVANCE:
        send_mock_email(
            recipient=resume_structured.full_name,
            template="INTERVIEW_INVITATION",
        )
        action_triggered = True
        action_type = "MOCK_EMAIL_INTERVIEW_INVITATION"
    elif decision_result.decision_outcome == DecisionOutcome.MANUAL_REVIEW:
        action_triggered = False
        action_type = None
    elif decision_result.decision_outcome == DecisionOutcome.REJECT:
        send_mock_email(
            recipient=resume_structured.full_name,
            template="REJECTION_NOTICE",
        )
        action_triggered = True
        action_type = "MOCK_EMAIL_REJECTION_NOTICE"
    else:
        raise ValueError("Unhandled decision outcome")

    # 5) Return structured results for API/audit consumption.
    return {
        "evaluation_id": None,
        "total_score": total_score,
        "score_breakdown": score_result.breakdown,
        "confidence_score": confidence_score,
        "summary": summary,
        "decision": decision_result.decision_outcome.value,
        "decision_reason": decision_result.reason,
        "thresholds_used": decision_result.thresholds_used,
        "decision_confidence_0_to_1": decision_result.decision_confidence_0_to_1,
        "action_triggered": action_triggered,
        "action_type": action_type,
    }


def _compute_confidence(score_result: ScoreResult, context: Mapping[str, Any] | None) -> float:
    extraction = (context or {}).get("extraction")
    extraction_quality = 1.0
    if isinstance(extraction, Mapping):
        resume_fb = bool(extraction.get("resume_fallback_used", False))
        job_fb = bool(extraction.get("job_fallback_used", False))
        if resume_fb and job_fb:
            extraction_quality = 0.4
        elif resume_fb or job_fb:
            extraction_quality = 0.7

    coverage = score_result.breakdown.get("required_skills_coverage")
    skill_ratio = None
    if isinstance(coverage, Mapping):
        try:
            skill_ratio = float(coverage.get("ratio_0_to_1"))
        except (TypeError, ValueError):
            skill_ratio = None
    if skill_ratio is None:
        skill_ratio = 0.5

    return _clamp01(skill_ratio * 0.6 + extraction_quality * 0.4)


def _apply_boosts(score_result: ScoreResult, context: Mapping[str, Any] | None) -> float:
    score = float(score_result.total_score)
    resume_text = (context or {}).get("resume_text")
    job_text = (context or {}).get("job_text")
    if not isinstance(resume_text, str) or not isinstance(job_text, str):
        return score

    rt = resume_text.casefold()
    jt = job_text.casefold()

    seniority_terms = ("senior", "principal", "staff", "lead", "architect", "manager", "head of")
    leadership_terms = ("led", "managed", "mentored", "ownership", "owned", "stakeholder", "roadmap", "strategy")

    resume_senior = any(t in rt for t in seniority_terms)
    resume_leadership = any(t in rt for t in leadership_terms)
    job_senior = any(t in jt for t in seniority_terms)

    boost = 0.0
    signals: list[str] = []
    if resume_senior:
        boost += 1.0
        signals.append("seniority_signal")
    if job_senior and resume_leadership:
        boost += 1.0
        signals.append("leadership_signal")

    if boost <= 0:
        return score

    boost = 2.0 if boost > 2.0 else boost
    total = score + boost
    total = 0.0 if total < 0.0 else 100.0 if total > 100.0 else total
    total = round(total, 2)

    score_result.breakdown["boosts"] = {"points": boost, "signals": signals}
    score_result.breakdown["total_score_0_to_100"] = total
    return total


def _clamp01(x: float) -> float:
    return 0.0 if x < 0.0 else 1.0 if x > 1.0 else x
