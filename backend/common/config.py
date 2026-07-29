"""
Application configuration - CyberQuote
Uses pydantic-settings for environment-based config
"""
from functools import lru_cache
from typing import Optional

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class AppSettings(BaseSettings):
    """Application settings"""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # App
    name: str = "CyberQuote"
    description: str = "AI Franchise Monitoring Platform"
    version: str = "0.1.0"
    debug: bool = False
    environment: str = "development"  # development, staging, production

    # API
    api_prefix: str = "/api/v1"

    # CORS
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    # JWT
    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24  # 24 hours
    refresh_token_expire_days: int = 7


class DatabaseSettings(BaseSettings):
    """Database settings"""

    model_config = SettingsConfigDict(env_prefix="DATABASE_", extra="ignore")

    host: str = "localhost"
    port: int = 5432
    name: str = "cyberquote"
    user: str = "postgres"
    password: str = "postgres"

    @property
    def url(self) -> str:
        """Get async database URL"""
        return f"postgresql+asyncpg://{self.user}:{self.password}@{self.host}:{self.port}/{self.name}"

    @property
    def sync_url(self) -> str:
        """Get sync database URL for alembic"""
        return f"postgresql://{self.user}:{self.password}@{self.host}:{self.port}/{self.name}"


class AWSSettings(BaseSettings):
    """AWS settings"""

    model_config = SettingsConfigDict(env_prefix="AWS_", extra="ignore")

    region: str = "ap-southeast-1"
    access_key_id: Optional[str] = None
    secret_access_key: Optional[str] = None
    s3_bucket: str = "cyberquote-data"

    # Cognito
    cognito_user_pool_id: Optional[str] = None
    cognito_client_id: Optional[str] = None


class OpenAISettings(BaseSettings):
    """OpenAI settings for Athena"""

    model_config = SettingsConfigDict(env_prefix="OPENAI_", extra="ignore")

    api_key: Optional[str] = None
    model: str = "gpt-4o-mini"
    max_tokens: int = 500
    temperature: float = 0.7


class RedisSettings(BaseSettings):
    """Redis settings"""

    model_config = SettingsConfigDict(env_prefix="REDIS_", extra="ignore")

    host: str = "localhost"
    port: int = 6379
    db: int = 0
    password: Optional[str] = None

    @property
    def url(self) -> str:
        if self.password:
            return f"redis://:{self.password}@{self.host}:{self.port}/{self.db}"
        return f"redis://{self.host}:{self.port}/{self.db}"


class KafkaSettings(BaseSettings):
    """Kafka settings (legacy - kept for compatibility)"""

    model_config = SettingsConfigDict(env_prefix="KAFKA_", extra="ignore")

    bootstrap_servers: str = "localhost:9092"
    consumer_group: str = "cyberquote-backend"
    auto_offset_reset: str = "earliest"


# =============================================================================
# SETTINGS INSTANCES
# =============================================================================


class SupabaseSettings(BaseSettings):
    """Supabase settings - replaces Kafka/Redis for MVP"""

    model_config = SettingsConfigDict(env_prefix="SUPABASE_", extra="ignore")

    url: str = "http://localhost:54321"
    anon_key: str = ""
    service_key: str = ""
    # JWT secret for verifying Supabase JWTs
    jwt_secret: Optional[str] = None


class HermesSettings(BaseSettings):
    """Hermes Agent settings - AI Brain orchestrator"""

    model_config = SettingsConfigDict(env_prefix="HERMES_", extra="ignore")

    api_url: str = "http://localhost:8001"
    api_key: Optional[str] = None
    mcp_server_url: str = "http://localhost:8001/mcp"
    # Tool execution timeout in seconds
    tool_timeout: int = 30


class WebhookSettings(BaseSettings):
    """Webhook ingestion settings"""

    model_config = SettingsConfigDict(env_prefix="WEBHOOK_", extra="ignore")

    # HMAC-SHA256 secret for validating webhooks
    hmac_secret: str = "change-me-in-production"
    # List of allowed source IPs (optional)
    allowed_ips: list[str] = []


class Settings(BaseSettings):
    """Main settings container"""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app: AppSettings = Field(default_factory=AppSettings)
    database: DatabaseSettings = Field(default_factory=DatabaseSettings)
    aws: AWSSettings = Field(default_factory=AWSSettings)
    openai: OpenAISettings = Field(default_factory=OpenAISettings)
    supabase: SupabaseSettings = Field(default_factory=SupabaseSettings)
    hermes: HermesSettings = Field(default_factory=HermesSettings)
    webhook: WebhookSettings = Field(default_factory=WebhookSettings)
    # Legacy: Keep for compatibility, deprecate in v1.0
    redis: RedisSettings = Field(default_factory=RedisSettings)
    kafka: KafkaSettings = Field(default_factory=KafkaSettings)


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()
