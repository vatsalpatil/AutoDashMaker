"""Application configuration.

Single-user local mode for now; every entity carries organization_id /
workspace_id / created_by columns so auth + multi-tenancy can be layered on
without a schema migration.
"""
import os
import sys
from pathlib import Path

from pydantic_settings import BaseSettings


BACKEND_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = BACKEND_ROOT / "data"
UPLOAD_DIR = BACKEND_ROOT / "uploads"


def _env_file() -> str | None:
    """backend/.env holds the real settings (the same ones the live server has), so `python Main.py` behaves like the server.
    Test scripts (tests/test_*.py) never read it: they must not touch real accounts or send real emails.
    DASHTOR_ENV_FILE overrides the choice ('' = read no file)."""
    if "DASHTOR_ENV_FILE" in os.environ:
        return os.environ["DASHTOR_ENV_FILE"] or None
    if Path(sys.argv[0]).name.startswith("test_"):
        return None
    return str(BACKEND_ROOT / ".env")


class Settings(BaseSettings):
    app_name: str = "Dashtor"
    # Analytical engine (DuckDB file holding ingested datasets as tables)
    analytics_db: str = str(DATA_DIR / "analytics.duckdb")
    # Metadata store (DuckDB too, per project decision; swappable to Postgres)
    metadata_db: str = str(DATA_DIR / "metadata.duckdb")
    upload_dir: str = str(UPLOAD_DIR)
    # Per-user limits, enforced only on hosted servers (AUTH_ENABLED); local mode is unlimited. Quota counts the
    # compressed Parquet files + uploads, not the size of what the user uploaded.
    max_upload_mb: int = 50
    user_quota_mb: int = 250
    max_rows_per_dataset: int = 5_000_000
    max_datasets: int = 20
    # Refuse uploads/imports once the data disk is more than this % full (0 = off)
    disk_usage_limit_pct: int = 80
    default_row_limit: int = 10_000
    query_timeout_s: int = 30
    # DuckDB resource limits (spec §55: 4 CPU / 20 GB box shared with other services)
    duckdb_memory_limit: str = "6GB"
    # "Copy a live table into the app" runs in its own process with its own small limits (a failure there must not take the server down)
    copy_memory_limit: str = "1GB"
    copy_threads: int = 2
    copy_timeout_s: int = 3600
    # Self-hosted models (Ollama on the same server): CPU generation is slow, so calls wait longer and run a few at a time
    ollama_num_ctx: int = 8192
    ollama_keep_alive: str = "30m"
    local_ai_parallel: int = 3
    local_ai_timeout_s: int = 900
    # A model hosted by the administrator for EVERY user (no personal key needed): its Ollama address and model tag.
    ollama_url: str = ""
    ollama_model: str = ""
    # Hosts a user-added AI provider may use even though they are private (the self-hosted Ollama service name), comma separated.
    allowed_ai_hosts: str = ""
    duckdb_threads: int = 3
    duckdb_temp_dir: str = str(DATA_DIR / "tmp")  # spill-to-disk location
    # In-process query-result cache (spec §53); invalidated on any data write
    result_cache_entries: int = 512
    result_cache_ttl_s: int = 900
    result_cache_max_rows: int = 5000        # don't cache one huge result...
    result_cache_total_rows: int = 300_000   # ...and never hold more than this many rows in all
    app_url: str = ""  # public address of the site (links in emails point here); empty = the first CORS origin
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
    # User-written Python transforms run in-process (Polars can read any file), so they are off for multi-user servers
    # Supabase only lets a password user sign in AFTER they clicked the confirmation link (ENABLE_EMAIL_AUTOCONFIRM=false), so
    # every signed-in user already proved their email. Turn on together with that Supabase setting.
    auth_confirms_email: bool = False
    allow_user_python: bool = False   # only consulted when auth_enabled; local mode always allows them
    supabase_service_key: str = ""    # SECRET service-role key: only used to change a user's email after they proved the new address
    supabase_jwt_secret: str = ""     # legacy HS256 projects; empty -> verify via JWKS (asymmetric keys)

    # Account verification (email + mobile one-time codes). Off by default so a fresh install can never lock anyone out:
    # first configure SMTP / SMS below, then set VERIFICATION_REQUIRED=true (existing users get the grace period).
    verification_required: bool = False
    verification_email: bool = True        # email counts toward "verified"
    verification_phone: bool = True        # mobile counts toward "verified"
    verification_grace_days: int = 7       # days after a user's first visit (or the feature going live) before blocking
    verification_dev_echo: bool = False    # return the code in the API response when delivery is the server log (dev/tests only)
    verification_secret: str = ""          # HMAC key for stored codes; empty -> derived from SUPABASE_JWT_SECRET
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""                    # e.g. "Dashtor <no-reply@yourdomain.com>"
    sms_provider: str = "console"          # console (log only) | twilio
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_from: str = ""                  # your Twilio number or messaging service sender

    class Config:
        env_file = _env_file()
        extra = "ignore"


settings = Settings()
DATA_DIR.mkdir(exist_ok=True)
UPLOAD_DIR.mkdir(exist_ok=True)
