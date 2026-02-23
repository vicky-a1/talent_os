from __future__ import annotations

import re
from typing import Optional

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


class StructuredJobDescription(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    required_skills: list[StrictStr] = Field(
        ...,
        min_length=1,
        description="Required skill tokens for the role. At least one item. Duplicates removed case-insensitively.",
    )
    preferred_skills: list[StrictStr] = Field(
        ...,
        description="Preferred (nice-to-have) skill tokens for the role. May be empty. Duplicates removed case-insensitively.",
    )
    minimum_years_experience: float = Field(
        ...,
        ge=0,
        description="Minimum years of experience required for the role. Must be >= 0.",
    )
    required_education: Optional[StrictStr] = Field(
        ...,
        description="Required education credential/level, or null if not required.",
    )
    domain: Optional[StrictStr] = Field(
        ...,
        description="Primary role domain tag, or null if not specified.",
    )

    @field_validator("required_skills", "preferred_skills")
    @classmethod
    def _validate_skill_lists(cls, v: list[StrictStr], info):
        return _validate_str_list(list(v), info.field_name)

    @field_validator("required_education", "domain")
    @classmethod
    def _validate_optionals(cls, v: Optional[StrictStr]):
        if v is None:
            return None
        token = _normalize_token(str(v))
        if not token:
            raise ValueError("must be null or a non-empty string")
        return token
