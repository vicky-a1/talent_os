from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.domain.enums import DecisionOutcome, EvaluationStatus


class EvaluationCreateRequest(BaseModel):
    job_document_id: UUID
    resume_document_id: UUID


class EvaluationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    job_document_id: UUID
    resume_document_id: UUID

    status: EvaluationStatus
    score: int | None = None
    decision: DecisionOutcome
    breakdown: dict | None = None

    created_at: datetime
    updated_at: datetime


class ErrorResponse(BaseModel):
    request_id: str | None = Field(default=None)
    detail: str
