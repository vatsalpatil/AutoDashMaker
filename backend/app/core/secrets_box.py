"""Encryption at rest for secret columns (AI provider keys, data-source connection settings with passwords).

Values are stored as `enc:v1:<Fernet token>` (AES-128-CBC + HMAC-SHA256). The key comes from DATA_ENCRYPTION_KEY
(a Fernet key; set it on the server) or, when unset, from `secret.key` next to the metadata DB, created on first use
and readable only by the server's user. Rows written before encryption (plain text) still read fine and are encrypted
on their next save. If the key is lost, encrypted values read as empty: the user re-enters the key / password.
"""
from __future__ import annotations

import logging
import os
from functools import lru_cache
from pathlib import Path
from typing import Any

from cryptography.fernet import Fernet, InvalidToken

from .config import settings

PREFIX = "enc:v1:"
SECRET_COLUMNS = {("ai_providers", "api_key"), ("datasources", "config")}
log = logging.getLogger("dashtor.secrets")


@lru_cache(maxsize=1)
def _fernet() -> Fernet:
    key = os.environ.get("DATA_ENCRYPTION_KEY", "").strip()
    if not key:
        path = Path(settings.metadata_db).parent / "secret.key"
        path.parent.mkdir(parents=True, exist_ok=True)
        try:   # 'x': only the first process creates it; a racing one reads the winner's key
            with open(path, "xb") as f:
                f.write(Fernet.generate_key())
            os.chmod(path, 0o600)
        except FileExistsError:
            pass
        except OSError:
            pass
        key = path.read_text().strip()
    return Fernet(key.encode())


def seal(table: str, col: str, value: Any) -> Any:
    """Encrypt a value bound for a secret column (already-encrypted and empty values pass through)."""
    if (table, col) not in SECRET_COLUMNS or not isinstance(value, str) or not value or value.startswith(PREFIX):
        return value
    return PREFIX + _fernet().encrypt(value.encode()).decode()


def open_(value: Any) -> Any:
    """Decrypt a stored value; anything without the prefix is returned unchanged."""
    if not isinstance(value, str) or not value.startswith(PREFIX):
        return value
    try:
        return _fernet().decrypt(value[len(PREFIX):].encode()).decode()
    except InvalidToken:
        log.error("cannot decrypt a stored secret: DATA_ENCRYPTION_KEY / secret.key changed")
        return ""
