from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    database_url: str = os.getenv("DATABASE_URL", "")
    groq_api_key: str = os.getenv("GROQ_API_KEY", "")
    groq_base_url: str = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1")
    groq_model: str = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
    session_ttl_hours: int = int(os.getenv("SESSION_TTL_HOURS", "24"))
    cookie_name: str = os.getenv("SESSION_COOKIE_NAME", "cynbit_session")
    cors_origins: tuple[str, ...] = tuple(
        origin.strip() for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",") if origin.strip()
    )
    public_https: bool = os.getenv("PUBLIC_HTTPS", "false").lower() in {"1", "true", "yes"}
    secure_cookies: bool = os.getenv("SECURE_COOKIES", "false").lower() in {"1", "true", "yes"}
    trust_proxy_headers: bool = os.getenv("TRUST_PROXY_HEADERS", "false").lower() in {"1", "true", "yes"}
    rate_limit_window_seconds: int = int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60"))
    rate_limit_max_attempts: int = int(os.getenv("RATE_LIMIT_MAX_ATTEMPTS", "10"))


settings = Settings()
