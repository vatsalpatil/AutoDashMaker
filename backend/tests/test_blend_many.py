"""Combine several datasets along relationships; one-to-many neighbours are skipped (no inflated totals).
Run: backend/.venv/Scripts/python.exe tests/test_blend_many.py"""
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
tmp = tempfile.mkdtemp()
os.environ.update(METADATA_DB=tmp + "/m.duckdb", ANALYTICS_DB=tmp + "/a.duckdb", UPLOAD_DIR=tmp + "/up", DUCKDB_TEMP_DIR=tmp + "/s")

from app.core.store import store
from app.services.engine import engine
from app.routers.transforms import BlendManyIn, blend_many

with engine.writer() as con:
    con.execute("CREATE TABLE ds_items AS SELECT * FROM (VALUES ('O1','P1',2), ('O1','P2',1), ('O2','P1',5)) t(order_id, product_id, quantity)")
    con.execute("CREATE TABLE ds_orders AS SELECT * FROM (VALUES ('O1','C1','Completed'), ('O2','C2','Returned')) t(order_id, customer_id, status)")
    con.execute("CREATE TABLE ds_products AS SELECT * FROM (VALUES ('P1','Laptop',100.0), ('P2','Pen',2.0)) t(product_id, name, unit_price)")
    con.execute("CREATE TABLE ds_customers AS SELECT * FROM (VALUES ('C1','Asha','North'), ('C2','Ravi','South')) t(customer_id, name, region)")
    con.execute("CREATE TABLE ds_targets AS SELECT * FROM (VALUES ('North','2025-01',10), ('North','2025-02',12), ('South','2025-01',9)) t(region, month, target)")

def ds(name, table, rows, cols):
    d = store.insert("datasets", {"name": name, "physical_name": table, "row_count": rows, "kind": "file"})
    for c in cols:
        store.insert("columns_meta", {"dataset_id": d["id"], "name": c, "dtype": "VARCHAR"})
    return d

items = ds("order_items", "ds_items", 3, ["order_id", "product_id", "quantity"])
orders = ds("orders", "ds_orders", 2, ["order_id", "customer_id", "status"])
products = ds("products", "ds_products", 2, ["product_id", "name", "unit_price"])
customers = ds("customers", "ds_customers", 2, ["customer_id", "name", "region"])
targets = ds("sales_targets", "ds_targets", 3, ["region", "month", "target"])
other = ds("unrelated", "ds_targets", 99, ["region"])   # bigger than the facts but linked to nothing: never the start
for l, lc, r, rc in [(orders, "order_id", items, "order_id"), (products, "product_id", items, "product_id"),
                     (customers, "customer_id", orders, "customer_id"), (customers, "region", targets, "region")]:
    store.insert("relationships", {"left_dataset_id": l["id"], "left_column": lc, "right_dataset_id": r["id"], "right_column": rc})

out = blend_many(BlendManyIn(name="sales_combined", dataset_ids=[d["id"] for d in (items, orders, products, customers, targets, other)]))
assert out["row_count"] == 3, out          # one row per order line: nothing multiplied
assert sorted(out["used"]) == ["customers", "order_items", "orders", "products"], out["used"]
skipped = {s["name"]: s["reason"] for s in out["skipped"]}
assert "inflate" in skipped["sales_targets"] and "no saved relationship" in skipped["unrelated"], skipped
rows = engine.execute(f"SELECT * FROM {out['physical_name']} ORDER BY order_id, product_id", 10)
cols = rows["columns"]
assert {"status", "unit_price", "region", "name", "customers_name"} <= set(cols), cols   # clashing 'name' prefixed
assert cols.count("order_id") == 1
from fastapi import HTTPException
try:
    blend_many(BlendManyIn(name="x", dataset_ids=[items["id"]])); raise SystemExit("one dataset accepted")
except HTTPException as e:
    assert e.status_code == 400
# transforms.frame works on any DuckDB result API (falls back to plain rows)
import duckdb
from app.services.transforms import frame
class Bare:
    def __init__(self, c): self.c, self.description = c, c.description
    def fetchall(self): return self.c.fetchall()
assert frame(Bare(duckdb.connect().execute("SELECT 2 AS a, 'y' AS b"))).to_dicts() == [{"a": 2, "b": "y"}]
print("test_blend_many OK")
