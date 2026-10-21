from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass


def parse_groq_api_keys(value: str) -> tuple[str, ...]:
    """Parse an ordered local key pool; tolerate commas, semicolons, or newlines."""
    normalized = value.replace(";", ",").replace("\r", "\n").replace("\n", ",")
    return tuple(dict.fromkeys(part.strip() for part in normalized.split(",") if part.strip()))


def parse_numbered_groq_api_keys(environment: Mapping[str, str | None] | None = None) -> tuple[str, ...]:
    """Read GROQ_KEY_<n> variables in numeric order without exposing their values."""
    source = os.environ if environment is None else environment
    indexed_keys: list[tuple[int, str, str]] = []
    prefix = "GROQ_KEY_"
    for name, value in source.items():
        if not name.startswith(prefix):
            continue
        suffix = name[len(prefix):]
        if not suffix.isdecimal() or int(suffix) < 1:
            continue
        key = value.strip() if isinstance(value, str) else ""
        if key:
            indexed_keys.append((int(suffix), name, key))
    indexed_keys.sort(key=lambda entry: (entry[0], entry[1]))
    return tuple(dict.fromkeys(key for _, _, key in indexed_keys))


@dataclass(frozen=True)
class Settings:
    database_url: str = os.getenv("DATABASE_URL", "")
    groq_api_key: str = os.getenv("GROQ_API_KEY", "")
    groq_api_keys: tuple[str, ...] = parse_groq_api_keys(os.getenv("GROQ_API_KEYS", ""))
    groq_numbered_api_keys: tuple[str, ...] = parse_numbered_groq_api_keys()
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

    @property
    def groq_keys(self) -> tuple[str, ...]:
        """Prefer numbered slots, then the comma-separated pool, then the legacy single key."""
        configured = (*self.groq_numbered_api_keys, *self.groq_api_keys, self.groq_api_key.strip())
        return tuple(dict.fromkeys(key for key in configured if key))


settings = Settings()
