"""Custom exceptions mapped to clean HTTP errors by the handlers in main.py."""

from __future__ import annotations


class AppError(Exception):
    """Base class for all expected application errors."""

    status_code = 400
    code = "app_error"

    def __init__(self, message: str, *, details: dict | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or {}


class NotFoundError(AppError):
    status_code = 404
    code = "not_found"


class ValidationFailure(AppError):
    status_code = 422
    code = "validation_error"


class FileTooLargeError(AppError):
    status_code = 413
    code = "file_too_large"


class UnsupportedFileTypeError(AppError):
    status_code = 415
    code = "unsupported_file_type"


class RateLimitError(AppError):
    status_code = 429
    code = "rate_limited"


class SandboxError(AppError):
    """Raised when LLM-generated code fails validation or execution.

    The message is written for the model so it can self-correct.
    """

    status_code = 400
    code = "sandbox_error"

    def __init__(self, message: str, *, details: dict | None = None) -> None:
        super().__init__(message, details=details)
        self.retry_hint = details.get("hint") if details else None


class LLMError(AppError):
    status_code = 502
    code = "llm_error"


class AgentError(AppError):
    status_code = 500
    code = "agent_error"
