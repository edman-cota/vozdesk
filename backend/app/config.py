from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    supabase_url: str
    # Nueva secret key (sb_secret_...). Solo en el servidor, nunca en el frontend.
    supabase_secret_key: str

    jwt_audience: str = "authenticated"
    cors_origins: str = "http://localhost:5174,http://127.0.0.1:5174"
    # Soporta cualquier subdominio de Cloudflare Pages (*.pages.dev) además de los orígenes explícitos
    cors_origin_regex: str | None = r"^https://.*\.pages\.dev$"
    host: str = "0.0.0.0"
    port: int = 8001  # En local 8001; en Render se inyecta PORT automáticamente

    @property
    def base_url(self) -> str:
        return self.supabase_url.rstrip("/")

    @property
    def jwks_url(self) -> str:
        return f"{self.base_url}/auth/v1/.well-known/jwks.json"

    @property
    def jwt_issuer(self) -> str:
        return f"{self.base_url}/auth/v1"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
