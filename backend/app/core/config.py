from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


# Secret values that must never be used outside of local development.
_INSECURE_JWT_SECRETS = {"change-me-in-prod", "change-this-in-production", "secret", ""}
_PRODUCTION_ENVS = {"production", "staging", "prod"}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "play_turf_api"
    environment: str = Field(default="development", alias="ENVIRONMENT")
    api_prefix: str = "/api"
    debug: bool = Field(default=False, alias="DEBUG")
    
    @field_validator('debug', mode='before')
    @classmethod
    def parse_debug(cls, v):
        if isinstance(v, str):
            return v.lower() in ('true', '1', 'yes', 'on')
        return v

    @field_validator('environment', mode='before')
    @classmethod
    def normalize_environment(cls, v):
        if isinstance(v, str):
            v = v.strip().lower()
        return v

    database_url: str = Field(
        default="sqlite:///./play_turf.db",
        alias="DATABASE_URL",
    )
    redis_url: str = Field(default="redis://localhost:6379/0", alias="REDIS_URL")

    jwt_secret_key: str = Field(default="change-me-in-prod", alias="JWT_SECRET_KEY")
    jwt_algorithm: str = "HS256"
    access_token_ttl_minutes: int = Field(default=15, alias="ACCESS_TOKEN_TTL_MINUTES")
    refresh_token_ttl_days: int = Field(default=7, alias="REFRESH_TOKEN_TTL_DAYS")
    secure_cookies: bool = Field(default=False, alias="SECURE_COOKIES")
    cookie_domain: str | None = Field(default=None, alias="COOKIE_DOMAIN")

    @field_validator('jwt_secret_key')
    @classmethod
    def validate_jwt_secret(cls, v: str, info) -> str:
        """Reject placeholder JWT secrets in production-like environments.

        Allows placeholders only in local development so the app still boots
        without extra configuration; in any other environment a weak secret
        fails fast rather than silently signing tokens with a public value.
        """
        env = info.data.get("environment", "development")
        if v in _INSECURE_JWT_SECRETS and env not in ("development", "docker"):
            raise ValueError(
                "JWT_SECRET_KEY is set to a known placeholder. "
                "Set a strong, unique secret via the JWT_SECRET_KEY env var."
            )
        if v not in _INSECURE_JWT_SECRETS and len(v) < 32:
            raise ValueError("JWT_SECRET_KEY must be at least 32 characters long.")
        return v

    @property
    def is_production_like(self) -> bool:
        return self.environment in _PRODUCTION_ENVS

    # Optional bootstrap credentials. When unset, no demo admin/client is
    # seeded (the previous weak defaults admin123/demo123 are removed).
    seed_admin_email: str = Field(default="", alias="SEED_ADMIN_EMAIL")
    seed_admin_password: str = Field(default="", alias="SEED_ADMIN_PASSWORD")
    seed_client_id: str = Field(default="", alias="SEED_CLIENT_ID")
    seed_client_password: str = Field(default="", alias="SEED_CLIENT_PASSWORD")

    # Allowed CORS origins. Comma-separated list via the ALLOWED_ORIGINS env var
    # (e.g. "https://app.playturf.app,https://admin.playturf.app"). Defaults are
    # localhost-only for development; production must override this.
    @field_validator("allowed_origins", mode="before")
    @classmethod
    def _split_origins(cls, v):
        if isinstance(v, str):
            return [o.strip() for o in v.split(",") if o.strip()]
        return v

    allowed_origins: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:8080",
            "http://localhost:5173",
            "http://localhost:8084",
        ],
        alias="ALLOWED_ORIGINS",
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
