from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter


router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    return {"status": "ok", "ts": datetime.now(tz=timezone.utc).isoformat()}
