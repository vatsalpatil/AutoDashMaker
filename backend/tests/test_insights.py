"""Run: backend/.venv/Scripts/python.exe tests/test_insights.py"""
import os
import sys
import tempfile
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
# Point the stores at a temp dir BEFORE any `app` import (app.services/__init__ loads the config).
tmp = tempfile.mkdtemp()
os.environ["METADATA_DB"] = tmp + "/m.duckdb"
os.environ["ANALYTICS_DB"] = tmp + "/a.duckdb"
os.environ["DUCKDB_TEMP_DIR"] = tmp + "/spill"
from app.services.insights import detect_insights

# An id column before the date must neither become the label nor be outlier-tested
rows = [{"order_id": i, "order_date": f"2026-0{1 + i % 9}-01", "amount": 5000.0 if i == 7 else 100.0} for i in range(12)]
texts = [x["text"] for x in detect_insights(rows, ["order_id", "order_date", "amount"])]
assert any("2026-" in t and "amount" in t for t in texts), texts      # labelled by the date column
assert not any(t.startswith("order_id") or "order_id =" in t for t in texts), texts

# Audit writes must not block the request path (each store write costs ~50 ms)
from app.core.store import store
from app.services import audit
audit.record("warmup")
audit.flush()
t0 = time.perf_counter()
for i in range(30):
    audit.record("x", detail=str(i))
enqueue_ms = (time.perf_counter() - t0) * 1000 / 30
assert enqueue_ms < 5, f"audit.record blocks the caller: {enqueue_ms:.1f} ms"
audit.flush()
rows = store.list("audit_log", where="action = 'x'")
assert len(rows) == 30 and {r["detail"] for r in rows} == {str(i) for i in range(30)}
print(f"insights/audit tests OK (record() {enqueue_ms:.2f} ms/call)")
