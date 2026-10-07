"""Auto-refresh + retry tests, run against a TEMP COPY of backend/data (never the real files).
Run: backend/.venv/Scripts/python.exe tests/test_refresh.py"""
import os
import shutil
import sys
import tempfile

ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, ROOT)
tmp = tempfile.mkdtemp()
shutil.copytree(os.path.join(ROOT, "data"), os.path.join(tmp, "data"), ignore=shutil.ignore_patterns("tmp"))
os.environ["ANALYTICS_DB"] = os.path.join(tmp, "data", "analytics.duckdb")
os.environ["METADATA_DB"] = os.path.join(tmp, "data", "metadata.duckdb")
os.environ["DUCKDB_TEMP_DIR"] = os.path.join(tmp, "spill")

import httpx
from app.connectors.base import http_retry
from app.core.store import store
from app.services import refresh as rf

# --- http_retry: transient 503 twice then success; and no retry on 404 ---
calls = {"n": 0}
def flaky():
    calls["n"] += 1
    return httpx.Response(503 if calls["n"] < 3 else 200)
assert http_retry(flaky, attempts=3, base_delay=0).status_code == 200 and calls["n"] == 3
calls["n"] = 0
def notfound():
    calls["n"] += 1
    return httpx.Response(404)
assert http_retry(notfound, attempts=3, base_delay=0).status_code == 404 and calls["n"] == 1

# --- due_datasets only picks opted-in, elapsed datasets ---
ds = [d for d in store.list("datasets") if d.get("source_id")]
assert ds, "need at least one source-backed dataset in backend/data"
target = ds[0]
assert not rf.due_datasets(), "nothing opted in yet -> nothing due"
store.update("datasets", target["id"], {"auto_refresh": True, "expected_interval_minutes": 1,
                                        "refreshed_at": "2020-01-01T00:00:00+00:00"})
due = rf.due_datasets()
assert [d["id"] for d in due] == [target["id"]], due

# --- successful refresh stamps refreshed_at and clears error; failure backs off ---
ok = rf.refresh_one(due[0])
after = store.get("datasets", target["id"])
if ok:
    assert str(after["refreshed_at"]) > "2026", after["refreshed_at"]
    assert after.get("last_refresh_error") is None
    print("refresh succeeded")
else:
    assert after["last_refresh_error"], "failure must be recorded"
    assert not rf.due_datasets(), "failed dataset must back off"
    print("refresh failed (recorded + backed off):", after["last_refresh_error"][:80])

# force a failure path deterministically: derived datasets need their base, others their source
broken = {"base_dataset_id": "missing"} if target.get("kind") == "derived" else {"source_id": "does-not-exist"}
store.update("datasets", target["id"], {**broken, "refreshed_at": "2020-01-01T00:00:00+00:00"})
rf._backoff.clear()
assert rf.refresh_one(store.get("datasets", target["id"])) is False
assert store.get("datasets", target["id"])["last_refresh_error"]
assert not rf.due_datasets(), "backoff must suppress retry"
print("refresh tests OK")

# --- background refresh job: starts at once, reports status, never raises into the thread ---
import time as _time
from app.services import refresh_jobs
_ds = store.list("datasets", order=None)[0]
_st = refresh_jobs.start(_ds["id"])
assert _st["status"] in ("running", "done"), _st
for _ in range(100):
    _st = refresh_jobs.status(_ds["id"])
    if _st["status"] != "running":
        break
    _time.sleep(0.1)
assert _st["status"] in ("done", "error"), _st  # a derived/file dataset in the copy: either outcome is reported, not raised
assert refresh_jobs.status("nope")["status"] == "idle"
print("refresh job tests OK")
