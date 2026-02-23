from __future__ import annotations

from enum import Enum


class EvaluationStatus(str, Enum):
    pending = "pending"
    completed = "completed"
    failed = "failed"


class DecisionOutcome(str, Enum):
    pending = "pending"
    advance = "advance"
    review = "review"
    reject = "reject"
