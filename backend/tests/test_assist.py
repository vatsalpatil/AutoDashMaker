"""AI assist actions, dialect conversion, schema linking. Run: backend/.venv/Scripts/python.exe tests/test_assist.py"""
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
tmp = tempfile.mkdtemp()  # temp stores BEFORE any `app` import
os.environ.update(METADATA_DB=tmp + "/m.duckdb", ANALYTICS_DB=tmp + "/a.duckdb", DUCKDB_TEMP_DIR=tmp + "/s")

from app.services import ai, assist
from app.services.dialects import DIALECTS, convert_sql

# ---- dialect conversion (deterministic) ----
pg = convert_sql("SELECT strftime(d, '%Y-%m') AS m FROM t", "postgres")
assert "TO_CHAR" in pg and pg.endswith(";"), pg
assert "`" in convert_sql('SELECT "a b" FROM t', "mysql") or "a b" in convert_sql('SELECT "a b" FROM t', "mysql")
for bad, why in [(("SELECT 1", "mongo"), "dialect"), (("", "postgres"), "empty"), (("SELEC FROM ((", "postgres"), "syntax")]:
    try:
        convert_sql(*bad)
        raise SystemExit(f"expected ValueError: {why}")
    except ValueError:
        pass
assert "postgres" in DIALECTS and "tsql" in DIALECTS

# ---- fix: model reply is extracted, bound-checked, and repaired once if the first fix still fails ----
asked = []
def chat_fix(msgs, *a, **k):
    asked.append(msgs[-1]["content"])
    return "```sql\nSELECT region FROM sales\n```" if len(asked) == 1 else "SELECT region FROM ds_sales"
ai.chat = chat_fix
check = lambda q: "Table sales does not exist" if " sales" in q.lower() and "ds_sales" not in q.lower() else None  # noqa: E731
fixed = assist.fix_sql("SELECT regoin FROM ds_sales", "Referenced column regoin not found", "ctx", None, check)
assert fixed == "SELECT region FROM ds_sales", fixed
assert "Referenced column regoin not found" in asked[0] and "does not exist" in asked[1], asked

# ---- optimize: returns rewritten SQL + notes; discards a rewrite that does not bind ----
ai.chat = lambda *a, **k: "```sql\nSELECT region, SUM(amount) FROM ds_sales GROUP BY region\n```\nNotes:\n- selected only needed columns\n- removed redundant subquery"
out = assist.optimize_sql("SELECT * FROM (SELECT * FROM ds_sales) GROUP BY region", "ctx", None, lambda q: None)
assert out["changed"] is True and len(out["notes"]) == 2 and "needed columns" in out["notes"][0], out
out = assist.optimize_sql("SELECT region, SUM(amount) FROM ds_sales GROUP BY region", "ctx", None, lambda q: "boom")
assert out["changed"] is False and out["sql"].startswith("SELECT region") and "did not bind" in out["notes"][0], out
ai.chat = lambda *a, **k: "I think it is fine as it is."
try:
    assist.optimize_sql("SELECT 1", "ctx", None, None)
    raise SystemExit("expected AIError")
except ai.AIError:
    pass

# ---- explain strips reasoning noise ----
ai.chat = lambda *a, **k: "<think>hmm</think>- Totals amount per region\n- Sorted high to low"
assert assist.explain_query("SELECT 1", "ctx", None) == "- Totals amount per region\n- Sorted high to low"

# ---- schema linking: with many tables only the relevant ones list their columns ----
from app.core.store import store
from app.services.ai_context import FULL_SCHEMA_TABLES, workbench_context as _workbench_context

ids = []
for i in range(FULL_SCHEMA_TABLES + 6):
    name = "ds_orders" if i == 3 else "ds_customers" if i == 9 else f"ds_misc_{i}"
    d = store.insert("datasets", {"name": name, "physical_name": name, "row_count": i, "kind": "file"})
    store.insert("columns_meta", {"dataset_id": d["id"], "name": f"col_{name}", "dtype": "INT"})
    ids.append(d["id"])
ctx = _workbench_context(ids[0], "show me total orders by customers")
with_cols = [ln for ln in ctx.splitlines() if ln.startswith("- ds_") and "columns omitted" not in ln]
assert len(with_cols) == 8, (len(with_cols), ctx)
assert any("ds_orders" in ln and "col_ds_orders" in ln for ln in with_cols), "relevant table must keep its columns"
assert any("ds_customers" in ln and "col_ds_customers" in ln for ln in with_cols)
assert any("ds_misc_0" in ln and "(selected)" in ln for ln in with_cols), "selected table always keeps columns"
assert "columns omitted" in ctx
print("assist tests OK")
