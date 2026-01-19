"""
ZooPrep - Configuration Management

Pydantic Settings for reading configuration from environment variables.
"""

from typing import List
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.

    All settings can be overridden via environment variables or .env file.
    """

    # Database
    database_url: str = "postgresql://sat_user:sat_password@localhost:5433/sat_tutor"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Security
    secret_key: str = "change-this-in-production-use-strong-random-key"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    # CORS
    allowed_origins: str = "http://localhost:3000,http://localhost:3001,http://localhost:8000"

    # Frontend URL (for password reset emails, etc.)
    frontend_url: str = "http://localhost:3000"

    # Application
    debug: bool = False
    environment: str = "development"

    # Logging
    log_level: str = "INFO"

    # Email (SendGrid)
    sendgrid_api_key: str = ""  # Set in production environment
    from_email: str = "noreply@zooprep.com"
    from_name: str = "ZooPrep"

    # Error Monitoring
    sentry_dsn: str = ""  # Set in production environment

    @property
    def allowed_origins_list(self) -> List[str]:
        """
        Parse allowed origins string into a list.

        Returns:
            List[str]: List of allowed origin URLs
        """
        return [origin.strip() for origin in self.allowed_origins.split(",")]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


# Global settings instance
settings = Settings()
