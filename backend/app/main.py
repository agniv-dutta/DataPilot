"""FastAPI application entrypoint: middleware, exception handlers, routers."""

from __future__ import annotations

import time
import uuid
from collections import defaultdict, deque
from contextvars import ContextVar

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import chat, files, health
from app.core.config import get_settings
from app.core.errors import AppError, RateLimitError
from app.core.logging import configure_logging, get_logger

logger = get_logger("app")

request_id_var: ContextVar[str | None] = ContextVar("request_id", default=None)

settings = get_settings()
configure_logging(settings.log_level)


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


class RateLimiter:
    """Fixed-window per-IP rate limiter (in-memory)."""

    def __init__(self, per_minute: int) -> None:
        self.per_minute = per_minute
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str) -> None:
        now = time.monotonic()
        window = self._hits[key]
        while window and now - window[0] > 60.0:
            window.popleft()
        if len(window) >= self.per_minute:
            raise RateLimitError(
                f"Rate limit exceeded ({self.per_minute} requests/minute). Wait a moment and retry."
            )
        window.append(now)


_rate_limiter = RateLimiter(settings.rate_limit_per_minute)


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version="1.0.0",
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def request_context(request: Request, call_next):
        rid = request.headers.get("x-request-id") or uuid.uuid4().hex[:12]
        token = request_id_var.set(rid)
        started = time.perf_counter()
        if request.method in {"POST", "PUT", "DELETE", "PATCH"}:
            try:
                _rate_limiter.check(_client_ip(request))
            except RateLimitError as exc:
                return JSONResponse(
                    status_code=exc.status_code,
                    content={
                        "error": {
                            "code": exc.code,
                            "message": exc.message,
                            "details": exc.details,
                            "request_id": rid,
                        }
                    },
                    headers={"X-Request-ID": rid},
                )
        try:
            response = await call_next(request)
        finally:
            request_id_var.reset(token)
        duration_ms = int((time.perf_counter() - started) * 1000)
        response.headers["X-Request-ID"] = rid
        logger.info(
            "request",
            extra={
                "request_id": rid,
                "duration_ms": duration_ms,
                "event": f"{request.method} {request.url.path}",
            },
        )
        return response

    @app.exception_handler(AppError)
    async def app_error_handler(_request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": exc.code,
                    "message": exc.message,
                    "details": exc.details,
                    "request_id": request_id_var.get(),
                }
            },
        )

    @app.exception_handler(RequestValidationError)
    async def validation_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "request_validation",
                    "message": "Request body failed validation.",
                    "details": [
                        {
                            "loc": [str(p) for p in err.get("loc", [])],
                            "msg": err.get("msg", ""),
                            "type": err.get("type", ""),
                        }
                        for err in exc.errors()
                    ],
                    "request_id": request_id_var.get(),
                }
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_handler(_request: Request, exc: Exception) -> JSONResponse:
        logger.exception("unhandled error")
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "internal_error",
                    "message": "An unexpected server error occurred.",
                    "details": {},
                    "request_id": request_id_var.get(),
                }
            },
        )

    app.include_router(health.router)
    app.include_router(files.router)
    app.include_router(chat.router)
    return app


app = create_app()
