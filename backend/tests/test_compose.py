"""Run: backend/.venv/Scripts/python.exe tests/test_compose.py"""
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
tmp = tempfile.mkdtemp()  # temp stores BEFORE any `app` import
os.environ.update(METADATA_DB=tmp + "/m.duckdb", ANALYTICS_DB=tmp + "/a.duckdb", DUCKDB_TEMP_DIR=tmp + "/s")

from app.services.compose import compose_sql, format_sql
from app.services.engine import QueryEngine


def flat(sql):
    return ' '.join(sql.lower().split())

Q1 = "SELECT product, SUM(amount) AS total FROM sales GROUP BY product ORDER BY total DESC LIMIT 3"
Q2 = "SELECT region, product, SUM(amount) AS total FROM sales GROUP BY region, product"
Q3 = "SELECT COUNT(*) AS n FROM sales"

# empty editor -> just the new query
assert "WITH" not in compose_sql("", Q1).upper()

# two queries -> two CTE steps, final select points at the newest
two = compose_sql(Q1 + ";", Q2)
low = flat(two)
assert "step_1 as (" in low and "step_2 as (" in low and low.rstrip().endswith("select * from step_2"), two

# a third query appends step_3 without re-wrapping the earlier steps
three = compose_sql(two, Q3)
assert flat(three).count("step_1 as (") == 1 and "step_3 as (" in flat(three), three

# a base that already has its own WITH is nested inside its step (no name clashes)
withq = "WITH x AS (SELECT * FROM sales) SELECT product FROM x"
nested = compose_sql(withq, "WITH x AS (SELECT 1 AS one) SELECT * FROM x")
assert nested.lower().count(" x as (") + nested.lower().count("\nx as (") >= 2 or "x AS (" in nested, nested

# custom step name is sanitised and made unique
named = compose_sql(Q1, Q2, "By Region!")
assert "by_region as (" in flat(named), named

# the composed SQL really runs (CTEs pass the read-only guard) and returns the newest step
e = QueryEngine(tmp + "/e.duckdb")
with e.writer() as c:
    c.execute("CREATE TABLE sales AS SELECT * FROM (VALUES ('N','a',10),('N','b',20),('S','a',30)) t(region, product, amount)")
r = e.execute(three)
assert r["rows"][0]["n"] == 3, r
r = e.execute(two)
assert r["row_count"] == 3 and set(r["columns"]) == {"region", "product", "total"}, r

# bad input is a clear ValueError, not a crash
for bad in ("DROP TABLE x", "not sql at all ((("):
    try:
        compose_sql(Q1, bad)
        raise SystemExit(f"expected ValueError for {bad!r}")
    except ValueError:
        pass

assert format_sql("select a,b from t where a=1").count("\n") >= 2
print("compose tests OK")

# ---- notebook cells: later cells query earlier ones by name ----
from app.services.compose import compose_cell_sql

cells = [
    {"name": "by_product", "sql": "SELECT product, SUM(amount) AS total FROM sales GROUP BY product"},
    {"name": "unused", "sql": "SELECT 999 AS nope"},
    {"name": "top", "sql": "SELECT * FROM by_product ORDER BY total DESC LIMIT 1;"},
    {"name": "report", "sql": "WITH t AS (SELECT * FROM top) SELECT product, total * 2 AS doubled FROM t"},
]
assert compose_cell_sql(cells, 0) == cells[0]["sql"], "a cell with no references runs as-is"
c2 = compose_cell_sql(cells, 2)
assert flat(c2).startswith("with by_product as (") and "unused" not in flat(c2), c2
c3 = compose_cell_sql(cells, 3, reserved={"sales"})
assert flat(c3).index("by_product as (") < flat(c3).index("top as (") and "__cell" in c3 and "unused" not in flat(c3), c3
r = e.execute(c3)
assert r["rows"][0] == {"product": "a", "doubled": 80}, r
assert e.execute(c2)["rows"][0]["total"] == 40, e.execute(c2)

for bad_cells, idx, why in [
    ([{"name": "1bad", "sql": "SELECT 1"}], 0, "identifier"),
    ([{"name": "a", "sql": "SELECT 1"}, {"name": "A", "sql": "SELECT 2"}], 1, "duplicate"),
    ([{"name": "sales", "sql": "SELECT 1"}], 0, "shadow table"),
    ([{"name": "a", "sql": ""}], 0, "empty"),
    ([{"name": "a", "sql": ""}, {"name": "b", "sql": "SELECT * FROM a"}], 1, "empty dependency"),
]:
    try:
        compose_cell_sql(bad_cells, idx, reserved={"sales"})
        raise SystemExit(f"expected ValueError: {why}")
    except ValueError:
        pass
print("cell compose tests OK")

# ---- run-cell endpoint: friendly hint when a cell uses one defined further down ----
from fastapi import HTTPException
from app.routers.queries import RunCellIn, run_cell
from app.services.engine import engine as global_engine

with global_engine.writer() as _c:  # the temp analytics DB must exist before the endpoint lists its tables
    _c.execute("SELECT 1")

try:
    run_cell(RunCellIn(cells=[{"name": "grand", "sql": "SELECT * FROM step_2"}, {"name": "step_2", "sql": "SELECT 1 AS x"}], index=0))
    raise SystemExit("expected HTTPException")
except HTTPException as exc:
    assert "further down" in exc.detail and "step_2" in exc.detail, exc.detail
# a column that merely shares a later cell's name must NOT trigger the hint
ok = run_cell(RunCellIn(cells=[{"name": "a", "sql": "SELECT 1 AS total"}, {"name": "total", "sql": "SELECT 2 AS y"}], index=0))
assert ok["rows"][0]["total"] == 1 and ok["chained"] is False
chained = run_cell(RunCellIn(cells=[{"name": "a", "sql": "SELECT 5 AS v"}, {"name": "b", "sql": "SELECT v * 2 AS w FROM a"}], index=1))
assert chained["rows"][0]["w"] == 10 and chained["chained"] is True and chained["sql"].upper().startswith("WITH A AS")
print("run-cell tests OK")
