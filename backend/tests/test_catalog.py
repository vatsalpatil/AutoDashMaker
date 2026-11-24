"""catalog: typed, batched reads of datasets and columns, tenant-scoped like the store.
Run: backend/.venv/Scripts/python.exe tests/test_catalog.py"""
from helpers import isolated, make_dataset
isolated()

from app.services.catalog import catalog

a = make_dataset("a", "SELECT 1 AS x, 'k' AS y")
b = make_dataset("b", "SELECT 2.5 AS z", folder="Proj")
blend = make_dataset("ab", "SELECT 1 AS x", kind="blend")

cols = catalog.columns_of([a["id"], b["id"], "missing"])
assert [c["name"] for c in cols[a["id"]]] == ["x", "y"] and [c["name"] for c in cols[b["id"]]] == ["z"], cols
assert cols["missing"] == [] and catalog.columns_of([]) == {}
assert catalog.columns(b["id"])[0]["dtype"].startswith("DECIMAL") or catalog.columns(b["id"])[0]["dtype"] == "DOUBLE"
assert catalog.dataset(b["id"])["folder"] == "Proj"
assert {d["name"] for d in catalog.datasets(include_blends=False)} == {"a", "b"}
print("test_catalog OK")
