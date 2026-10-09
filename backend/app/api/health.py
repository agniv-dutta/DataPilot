"""Health endpoint."""

from __future__ import annotations

import os

from fastapi import APIRouter

from app.core.config import get_settings
from app.models.schemas import HealthResponse

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    settings = get_settings()
    if settings.llm_provider == "anthropic":
        configured = bool(os.environ.get("ANTHROPIC_API_KEY"))
    else:
        configured = bool(os.environ.get("OPENAI_API_KEY"))
    return HealthResponse(
        status="ok",
        version="1.0.0",
        llm_provider=settings.llm_provider,
        llm_configured=configured,
    )
