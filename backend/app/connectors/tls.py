"""TLS / certificate options shared by the database connectors.

Certificate files (.pem, .crt, .key …) are uploaded through `POST /api/sources/files` into `uploads/certs/`.
A source stores only the path; connectors accept paths inside that folder and nothing else, so a saved
source can never be pointed at arbitrary files on the server.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from ..core.config import settings
from .base import ConnectorError
from ..core import tenant



def cert_dir() -> Path:
    """Uploaded TLS files live inside the uploading user's own folder."""
    d = tenant.upload_dir() / "certs"
    d.mkdir(parents=True, exist_ok=True)
    return d


CERT_EXTENSIONS = {".pem", ".crt", ".cer", ".key", ".ca", ".p12"}
MAX_CERT_BYTES = 64 * 1024


def sql_escape(value: Any) -> str:
    """Escape a value for use inside a single-quoted DuckDB string literal."""
    return str(value).replace("'", "''")


def cert_path(value: Any) -> str | None:
    """A validated absolute, forward-slash path to an uploaded certificate file (None when unset)."""
    if not value:
        return None
    p = Path(str(value)).resolve()
    if cert_dir().resolve() not in p.parents:
        raise ConnectorError("certificate files must be uploaded through the source form")
    if not p.is_file():
        raise ConnectorError(f"certificate file is missing on the server: {p.name} (upload it again)")
    return p.as_posix()


def mysql_ssl(config: dict[str, Any]) -> str:
    """` ssl_mode=… ssl_ca=…` fragment for DuckDB's MySQL ATTACH string (empty when no TLS options are set)."""
    parts = []
    if config.get("ssl_mode"):
        parts.append(f"ssl_mode={config['ssl_mode']}")
    for key in ("ssl_ca", "ssl_cert", "ssl_key"):
        path = cert_path(config.get(key))
        if path:
            parts.append(f"{key}={path}")
    return (" " + " ".join(parts)) if parts else ""


def postgres_ssl(config: dict[str, Any]) -> str:
    """` sslmode=… sslrootcert=…` fragment for the libpq connection string."""
    parts = []
    if config.get("ssl_mode"):
        parts.append(f"sslmode={config['ssl_mode']}")
    for key, libpq in (("ssl_ca", "sslrootcert"), ("ssl_cert", "sslcert"), ("ssl_key", "sslkey")):
        path = cert_path(config.get(key))
        if path:
            parts.append(f"{libpq}={path}")
    return (" " + " ".join(parts)) if parts else ""
