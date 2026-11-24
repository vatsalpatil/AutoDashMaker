"""Key number suggestions: no meaningless totals on lookup tables (one row per product/customer, no dates).
Run: backend/.venv/Scripts/python.exe tests/test_metric_suggestions.py"""
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
t = tempfile.mkdtemp()
os.environ.update(METADATA_DB=t + "/m.duckdb", ANALYTICS_DB=t + "/a.duckdb", UPLOAD_DIR=t + "/u", DUCKDB_TEMP_DIR=t + "/s")

from app.core.store import store
from app.services.metrics import suggestions

p = store.insert("datasets", {"name": "products", "physical_name": "ds_p", "row_count": 34})
for n, dt, d in [("product_id", "VARCHAR", 34), ("unit_price", "BIGINT", 30), ("unit_cost", "BIGINT", 30)]:
    store.insert("columns_meta", {"dataset_id": p["id"], "name": n, "dtype": dt, "distinct_count": d})
o = store.insert("datasets", {"name": "sales", "physical_name": "ds_s", "row_count": 900})
for n, dt, d in [("order_id", "VARCHAR", 300), ("order_date", "DATE", 200), ("revenue", "DOUBLE", 800), ("unit_cost", "DOUBLE", 50)]:
    store.insert("columns_meta", {"dataset_id": o["id"], "name": n, "dtype": dt, "distinct_count": d})

labels = {(m["dataset_name"], m["label"]) for m in suggestions()["metrics"]}
assert ("products", "Total unit_cost") not in labels and ("products", "Total unit_price") not in labels, labels
assert ("products", "Number of products") in labels and not any(d == "products" and l.startswith(("Average", "Unique")) for d, l in labels), labels
assert ("sales", "Total revenue") in labels and ("sales", "Total unit_cost") not in labels, labels   # cost per unit isn't summed
# starter questions (Ask / Query Builder chips): facts first, no totals of prices, lookup tables get counts
store.insert("columns_meta", {"dataset_id": p["id"], "name": "category", "dtype": "VARCHAR", "distinct_count": 4})
store.insert("columns_meta", {"dataset_id": o["id"], "name": "region", "dtype": "VARCHAR", "distinct_count": 4})
from app.services.analyst import starter_questions
qs = starter_questions()
assert qs[0] == "Total revenue by region in sales", qs
assert "How many products are in each category?" in qs, qs
assert not any("unit_price" in q or "unit_cost" in q for q in qs), qs
print("test_metric_suggestions OK")
