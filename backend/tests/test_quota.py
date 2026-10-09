"""Parquet-backed datasets + per-user quotas. Run: backend/.venv/Scripts/python.exe tests/test_quota.py"""
import asyncio
import io
import os
import sys
import tempfile

ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, ROOT)
tmp = tempfile.mkdtemp()
os.environ["ANALYTICS_DB"] = os.path.join(tmp, "analytics.duckdb")
os.environ["METADATA_DB"] = os.path.join(tmp, "metadata.duckdb")
os.environ["DUCKDB_TEMP_DIR"] = os.path.join(tmp, "spill")
os.environ["UPLOAD_DIR"] = os.path.join(tmp, "uploads")
os.environ["DISK_USAGE_LIMIT_PCT"] = "0"

from fastapi import HTTPException, UploadFile

from app.core.config import settings
from app.core.store import store
from app.routers import datasets
from app.services import columnar, ingest, quota
from app.services.engine import engine


def up(name: str, text: str) -> dict:
    return asyncio.run(datasets.upload(UploadFile(io.BytesIO(text.encode()), filename=name, size=len(text))))


csv = "id,region,amount\n" + "\n".join(f"{i},{'NS'[i % 2]},{i * 1.5}" for i in range(2000))

# 1. local mode: stored as a Parquet file, the dataset name is a VIEW, the original upload is kept
ds = up("sales.csv", csv)
pq = columnar.parquet_path(ds["physical_name"])
assert pq.exists() and pq.stat().st_size < len(csv), (pq.exists(), pq.stat().st_size, len(csv))
with engine.connect(read_only=True) as con:
    kinds = dict(con.execute("SELECT table_name, table_type FROM information_schema.tables").fetchall())
assert kinds[ds["physical_name"]] == "VIEW" and ds["physical_name"] + "__stg" not in kinds, kinds
assert ds["row_count"] == 2000 and ds["column_count"] == 3
assert engine.execute(f"SELECT COUNT(*) AS n FROM {ds['physical_name']}")["rows"][0]["n"] == 2000
assert engine.describe_table(ds["physical_name"])["row_count"] == 2000
assert (os.path.exists(os.path.join(tmp, "uploads", "sales.csv"))), "local mode keeps the original"

# 2. refresh rewrites the file and the view keeps working
assert ingest.refresh_dataset(ds["id"])["row_count"] == 2000
assert engine.execute(f"SELECT SUM(amount) AS s FROM {ds['physical_name']}")["rows"][0]["s"] > 0

# 3. delete removes the view AND the file
engine.drop_table(ds["physical_name"])
columnar.remove(ds["physical_name"])
store.delete("datasets", ds["id"])
assert not pq.exists()

# 4. hosted mode: limits on
quota.enforced = lambda: True
settings.max_upload_mb, settings.user_quota_mb, settings.max_rows_per_dataset, settings.max_datasets = 1, 5, 1500, 2

ok = up("small.csv", "a,b\n1,2\n3,4\n")
assert not os.path.exists(os.path.join(tmp, "uploads", "small.csv")), "hosted mode drops the original"
assert quota.usage()["used_mb"] >= 0 and quota.usage()["limit_mb"] == 5


def refused(fn, code):
    try:
        fn()
    except HTTPException as e:
        assert e.status_code == code, (e.status_code, e.detail)
        return e.detail
    raise AssertionError("expected HTTPException %s" % code)


refused(lambda: up("big.csv", "x\n" + "1234567890\n" * 120_000), 413)          # > 1 MB cap, streamed
assert not os.path.exists(os.path.join(tmp, "uploads", "big.csv"))
refused(lambda: up("rows.csv", csv), 400)                                          # 2000 rows > 1500 cap
up("second.csv", "a\n1\n")
refused(lambda: up("third.csv", "a\n1\n"), 507)                                    # dataset count cap (2)
assert len(store.list("datasets", order=None)) == 2
print("quota + parquet storage tests OK")
