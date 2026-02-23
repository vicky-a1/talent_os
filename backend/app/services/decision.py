from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any, Mapping


class DecisionOutcome(str, Enum):
    AUTO_ADVANCE = "AUTO_ADVANCE"
    MANUAL_REVIEW = "MANUAL_REVIEW"
    REJECT = "REJECT"


@dataclass(frozen=True)
class DecisionResult:
    decision_outcome: DecisionOutcome
    reason: str
    thresholds_used: dict[str, float]
    decision_confidence_0_to_1: float


def decide(total_score: float, rubric: Mapping[str, Any], *, confidence_score: float | None = None) -> DecisionResult:
    """
    Deterministic decision engine based on threshold rules.

    - No DB calls, no LLM calls, no side effects.
    - Uses rubric thresholds if provided; otherwise falls back to defaults.
    """

    score = _validate_score(total_score)
    thresholds = _extract_thresholds(rubric)

    auto_advance = thresholds["auto_advance"]
    manual_review = thresholds["manual_review"]
    band = _extract_borderline_band(rubric)

    if score >= auto_advance:
        return DecisionResult(
            decision_outcome=DecisionOutcome.AUTO_ADVANCE,
            reason=_reason_auto(score=score, auto_advance=auto_advance, manual_review=manual_review, band=band),
            thresholds_used=thresholds,
            decision_confidence_0_to_1=_decision_confidence(
                decision=DecisionOutcome.AUTO_ADVANCE,
                score=score,
                auto_advance=auto_advance,
                manual_review=manual_review,
                confidence_score=confidence_score,
            ),
        )

    if score >= manual_review:
        return DecisionResult(
            decision_outcome=DecisionOutcome.MANUAL_REVIEW,
            reason=_reason_manual(score=score, auto_advance=auto_advance, manual_review=manual_review, band=band),
            thresholds_used=thresholds,
            decision_confidence_0_to_1=_decision_confidence(
                decision=DecisionOutcome.MANUAL_REVIEW,
                score=score,
                auto_advance=auto_advance,
                manual_review=manual_review,
                confidence_score=confidence_score,
            ),
        )

    if score >= manual_review - band:
        return DecisionResult(
            decision_outcome=DecisionOutcome.MANUAL_REVIEW,
            reason=_reason_borderline(score=score, auto_advance=auto_advance, manual_review=manual_review, band=band),
            thresholds_used=thresholds,
            decision_confidence_0_to_1=_decision_confidence(
                decision=DecisionOutcome.MANUAL_REVIEW,
                score=score,
                auto_advance=auto_advance,
                manual_review=manual_review,
                confidence_score=confidence_score,
            ),
        )

    return DecisionResult(
        decision_outcome=DecisionOutcome.REJECT,
        reason=_reason_reject(score=score, auto_advance=auto_advance, manual_review=manual_review, band=band),
        thresholds_used=thresholds,
        decision_confidence_0_to_1=_decision_confidence(
            decision=DecisionOutcome.REJECT,
            score=score,
            auto_advance=auto_advance,
            manual_review=manual_review,
            confidence_score=confidence_score,
        ),
    )


def _extract_thresholds(rubric: Mapping[str, Any]) -> dict[str, float]:
    """
    Threshold extraction/validation rules:
    - Defaults if not defined: auto_advance=80, manual_review=60
    - All thresholds must be numbers within 0..100
    - auto_advance must be >= manual_review
    - Raises ValueError if invalid
    """

    defaults = {"auto_advance": 80.0, "manual_review": 60.0}
    raw = rubric.get("thresholds")

    if raw is None:
        return defaults

    if not isinstance(raw, Mapping):
        raise ValueError("rubric.thresholds must be a mapping if provided")

    auto_advance = _as_threshold(raw.get("auto_advance", defaults["auto_advance"]), "auto_advance")
    manual_review = _as_threshold(raw.get("manual_review", defaults["manual_review"]), "manual_review")

    if auto_advance < manual_review:
        raise ValueError("thresholds invalid: auto_advance must be >= manual_review")

    return {"auto_advance": auto_advance, "manual_review": manual_review}


def _extract_borderline_band(rubric: Mapping[str, Any]) -> float:
    raw = rubric.get("thresholds")
    if not isinstance(raw, Mapping):
        return 1.0
    value = raw.get("borderline_band", 1.0)
    try:
        v = float(value)
    except (TypeError, ValueError):
        return 1.0
    if v < 0:
        return 0.0
    if v > 10:
        return 10.0
    return v


def _reason_auto(*, score: float, auto_advance: float, manual_review: float, band: float) -> str:
    if score < auto_advance + band:
        return f"Auto-advance: score {score:.2f} is just above the {auto_advance:.2f} threshold."
    return f"Auto-advance: score {score:.2f} clears the {auto_advance:.2f} threshold."


def _reason_manual(*, score: float, auto_advance: float, manual_review: float, band: float) -> str:
    if score >= auto_advance - band:
        return f"Manual review: score {score:.2f} is borderline for auto-advance ({auto_advance:.2f})."
    return f"Manual review: score {score:.2f} meets the review threshold ({manual_review:.2f})."


def _reason_borderline(*, score: float, auto_advance: float, manual_review: float, band: float) -> str:
    return f"Manual review: score {score:.2f} is within {band:.2f} of the review threshold ({manual_review:.2f})."


def _reason_reject(*, score: float, auto_advance: float, manual_review: float, band: float) -> str:
    if band > 0:
        return f"Reject: score {score:.2f} is below the review threshold ({manual_review:.2f})."
    return f"Reject: score {score:.2f} < manual_review {manual_review:.2f}"


def _decision_confidence(
    *,
    decision: DecisionOutcome,
    score: float,
    auto_advance: float,
    manual_review: float,
    confidence_score: float | None,
) -> float:
    if decision == DecisionOutcome.AUTO_ADVANCE:
        margin = score - auto_advance
    elif decision == DecisionOutcome.REJECT:
        margin = manual_review - score
    else:
        lower = score - manual_review
        upper = auto_advance - score
        margin = lower if lower < upper else upper

    margin = 0.0 if margin < 0.0 else margin
    base = 0.5 + 0.5 * _clamp01(margin / 10.0)

    if confidence_score is None:
        return _clamp01(base)

    return _clamp01(base * 0.6 + _clamp01(float(confidence_score)) * 0.4)


def _clamp01(x: float) -> float:
    return 0.0 if x < 0.0 else 1.0 if x > 1.0 else x


def _as_threshold(value: Any, name: str) -> float:
    try:
        v = float(value)
    except (TypeError, ValueError):
        raise ValueError(f"threshold '{name}' must be a number") from None

    if v < 0 or v > 100:
        raise ValueError(f"threshold '{name}' must be within 0..100")

    return v


def _validate_score(total_score: float) -> float:
    try:
        score = float(total_score)
    except (TypeError, ValueError):
        raise ValueError("total_score must be a number") from None

    if score < 0 or score > 100:
        raise ValueError("total_score must be within 0..100")

    return score
