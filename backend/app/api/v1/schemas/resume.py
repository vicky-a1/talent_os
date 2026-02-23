from __future__ import annotations

import re

from pydantic import BaseModel, ConfigDict, Field, StrictStr, field_validator


_ws_re = re.compile(r"\s+")


def _normalize_token(value: str) -> str:
    return _ws_re.sub(" ", value.strip())


def _validate_str_list(values: list[str], field_name: str) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []

    for raw in values:
        token = _normalize_token(raw)
        if not token:
            raise ValueError(f"{field_name} must not contain empty items")

        key = token.casefold()
        if key in seen:
            continue
        seen.add(key)
        out.append(token)

    return out


class StructuredResume(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    full_name: StrictStr = Field(
        ...,
        min_length=1,
        description="Candidate full name. Non-empty canonical string.",
    )
    skills: list[StrictStr] = Field(
        ...,
        description="Normalized skill tokens. No empty items. Duplicates removed case-insensitively.",
    )
    total_years_experience: float = Field(
        ...,
        ge=0,
        description="Total professional experience in years. Must be >= 0.",
    )
    companies: list[StrictStr] = Field(
        ...,
        description="Employer/company names. No empty items. Duplicates removed case-insensitively.",
    )
    education: list[StrictStr] = Field(
        ...,
        description="Education entries. No empty items. Duplicates removed case-insensitively.",
    )
    projects: list[StrictStr] = Field(
        ...,
        description="Project titles/identifiers. No empty items. Duplicates removed case-insensitively.",
    )
    domains: list[StrictStr] = Field(
        ...,
        description="Domain tags. No empty items. Duplicates removed case-insensitively.",
    )

    @field_validator("skills", "companies", "education", "projects", "domains")
    @classmethod
    def _validate_lists(cls, v: list[StrictStr], info):
        return _validate_str_list(list(v), info.field_name)
