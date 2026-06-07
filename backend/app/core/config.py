from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


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

    allowed_origins: list[str] = ["http://localhost:8080", "http://localhost:5173", "http://localhost:8084"]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
