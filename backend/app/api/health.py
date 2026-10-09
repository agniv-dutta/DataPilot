"""Health endpoint."""

from __future__ import annotations

from fastapi import APIRouter

from app.core.config import get_settings
from app.models.schemas import HealthResponse

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    settings = get_settings()
    configured = bool(settings.groq_api_key.get_secret_value())
    return HealthResponse(
        status="ok",
        version="1.0.0",
        llm_provider=settings.llm_provider,
        llm_configured=configured,
    )
