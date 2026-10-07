"""Application configuration.

Single-user local mode for now; every entity carries organization_id /
workspace_id / created_by columns so auth + multi-tenancy can be layered on
without a schema migration.
"""
from pathlib import Path

from pydantic_settings import BaseSettings


BACKEND_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = BACKEND_ROOT / "data"
UPLOAD_DIR = BACKEND_ROOT / "uploads"


class Settings(BaseSettings):
    app_name: str = "AutoDashMaker"
    # Analytical engine (DuckDB file holding ingested datasets as tables)
    analytics_db: str = str(DATA_DIR / "analytics.duckdb")
    # Metadata store (DuckDB too, per project decision; swappable to Postgres)
    metadata_db: str = str(DATA_DIR / "metadata.duckdb")
    upload_dir: str = str(UPLOAD_DIR)
    max_upload_mb: int = 200
    default_row_limit: int = 10_000
    query_timeout_s: int = 30
    # DuckDB resource limits (spec §55: 4 CPU / 20 GB box shared with other services)
    duckdb_memory_limit: str = "6GB"
    duckdb_threads: int = 3
    duckdb_temp_dir: str = str(DATA_DIR / "tmp")  # spill-to-disk location
    # In-process query-result cache (spec §53); invalidated on any data write
    result_cache_entries: int = 128
    result_cache_ttl_s: int = 300
    result_cache_max_rows: int = 1000  # don't cache huge results
    cors_origins: list[str] = [
        "http://localhost:5174", "http://127.0.0.1:5174",
        "http://localhost:5173", "http://127.0.0.1:5173",
    ]

    # Default free AI provider (Gemini free tier). Overridable via .env / UI.
    default_ai_provider: str = "gemini"
    default_ai_model: str = "gemini-2.0-flash"

    # Authentication (Supabase Auth JWTs). Off by default = single-user local mode.
    auth_enabled: bool = False
    supabase_url: str = ""            # e.g. https://xyz.supabase.co or your self-hosted URL
    supabase_anon_key: str = ""       # public key; served to the browser via /api/auth/config
    supabase_jwt_secret: str = ""     # legacy HS256 projects; empty -> verify via JWKS (asymmetric keys)

    class Config:
        env_file = str(BACKEND_ROOT / ".env")
        extra = "ignore"


settings = Settings()
DATA_DIR.mkdir(exist_ok=True)
UPLOAD_DIR.mkdir(exist_ok=True)
