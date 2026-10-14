"""Encryption at rest: AI keys and data-source configs are stored encrypted and read back plain. Run: python tests/test_secrets.py"""
import os
import shutil
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
TMP = tempfile.mkdtemp(prefix="adm_secrets_")
os.environ.update(METADATA_DB=f"{TMP}/metadata.duckdb", ANALYTICS_DB=f"{TMP}/analytics.duckdb", UPLOAD_DIR=f"{TMP}/uploads")

from app.core.store import store  # noqa: E402

try:
    p = store.insert("ai_providers", {"label": "x", "provider": "openai", "model": "m", "api_key": "sk-test-123"})
    raw = store.execute("SELECT api_key FROM ai_providers WHERE id = ?", [p["id"]])
    with store._lock, store._conn() as con:  # noqa: SLF001  (look at the bytes really on disk)
        on_disk = con.execute("SELECT api_key FROM ai_providers WHERE id = ?", [p["id"]]).fetchone()[0]
    assert on_disk.startswith("enc:v1:") and "sk-test-123" not in on_disk, on_disk
    assert raw[0]["api_key"] == "sk-test-123" and store.get("ai_providers", p["id"])["api_key"] == "sk-test-123"
    store.update("ai_providers", p["id"], {"api_key": "sk-new"})
    assert store.get("ai_providers", p["id"])["api_key"] == "sk-new"

    ds = store.insert("datasources", {"name": "pg", "type": "postgres", "config": {"host": "h", "password": "Sup3r-Secret-Passw0rd!"}})
    with store._lock, store._conn() as con:  # noqa: SLF001
        assert "Sup3r-Secret" not in con.execute("SELECT config FROM datasources WHERE id = ?", [ds["id"]]).fetchone()[0]
    assert store.get("datasources", ds["id"])["config"] == {"host": "h", "password": "Sup3r-Secret-Passw0rd!"}

    with store._lock, store._conn() as con:  # noqa: SLF001  (a legacy plain row gets encrypted on startup)
        con.execute("UPDATE ai_providers SET api_key = 'plain-old' WHERE id = ?", [p["id"]])
    store._init()  # noqa: SLF001
    assert store.get("ai_providers", p["id"])["api_key"] == "plain-old"
    with store._lock, store._conn() as con:  # noqa: SLF001
        assert con.execute("SELECT api_key FROM ai_providers WHERE id = ?", [p["id"]]).fetchone()[0].startswith("enc:v1:")
    print("PASS test_secrets")
finally:
    shutil.rmtree(TMP, ignore_errors=True)
