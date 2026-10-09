"""Application configuration loaded from environment variables."""

from functools import lru_cache

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings. Keys come from env only, never hardcoded."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "AI Data Analyst"
    environment: str = "development"
    debug: bool = False

    cors_origins: str = "http://localhost:5173,http://localhost:4173"

    # Uploads / datasets
    max_upload_bytes: int = 25 * 1024 * 1024  # 25MB
    max_files_per_session: int = 20
    max_rows_profiled: int = 200_000
    sample_rows: int = 5

    # Sandbox
    sql_timeout_seconds: float = 10.0
    pandas_timeout_seconds: float = 10.0
    max_result_rows: int = 10_000
    max_query_cache: int = 128

    # Agent
    llm_provider: str = "groq"
    groq_api_key: SecretStr = SecretStr("")
    groq_model: str = "openai/gpt-oss-120b"
    groq_base_url: str = "https://api.groq.com"
    llm_max_tokens: int = 4096
    agent_max_iterations: int = 6
    memory_token_budget: int = 8000

    # Ops
    rate_limit_per_minute: int = 60
    log_level: str = "INFO"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
