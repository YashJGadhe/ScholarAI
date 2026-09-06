"""ScholarAI settings — everything secret lives in environment variables."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # MongoDB
    MONGODB_URI: str = "mongodb://localhost:27017"
    MONGODB_DATABASE: str = "scholarai"

    # Auth
    JWT_SECRET_KEY: str = "dev-only-insecure-secret-change-me"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    # CORS
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:4173"

    # External APIs (never hard-coded)
    ORCID_CLIENT_ID: str = ""
    ORCID_CLIENT_SECRET: str = ""
    SCOPUS_API_KEY: str = ""
    WOS_API_KEY: str = ""
    SERPAPI_API_KEY: str = ""
    RESEARCHGATE_MODE: str = "OFF"

    # Registration policy
    ALLOWED_EMAIL_DOMAINS: str = ""
    STUDENT_EMAIL_DOMAINS: str = ""

    # HTTP behaviour for connectors
    CONNECTOR_TIMEOUT_SECONDS: float = 15.0

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def allowed_email_domains(self) -> list[str]:
        return [d.strip().lower() for d in self.ALLOWED_EMAIL_DOMAINS.split(",") if d.strip()]

    @property
    def student_email_domains(self) -> list[str]:
        return [d.strip().lower() for d in self.STUDENT_EMAIL_DOMAINS.split(",") if d.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
