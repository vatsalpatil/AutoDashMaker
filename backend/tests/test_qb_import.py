"""Run: backend/.venv/Scripts/python.exe tests/test_qb_import.py  — SQL -> builder spec must round-trip exactly or be wrapped."""
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
tmp = tempfile.mkdtemp()
os.environ.update(METADATA_DB=tmp + "/m.duckdb", ANALYTICS_DB=tmp + "/a.duckdb", DUCKDB_TEMP_DIR=tmp + "/s")

from app.core.store import store
from app.services.engine import engine
from app.services.qb import compile_spec
from app.services.qb_import import sql_to_spec

with engine.writer() as con:
    con.execute("CREATE TABLE ds_sales AS SELECT * FROM (VALUES (1,'N',10.0,DATE '2024-01-05'),(2,'N',20.0,DATE '2024-02-05'),(3,'S',5.0,DATE '2024-02-09'),(1,'S',7.0,DATE '2024-03-01')) t(cid,region,amount,d)")
    con.execute("CREATE TABLE ds_cust AS SELECT * FROM (VALUES (1,'Ann'),(2,'Bob')) t(cid,name)")
for n, p in (("Sales", "ds_sales"), ("Cust", "ds_cust")):
    d = store.insert("datasets", {"name": n, "physical_name": p, "workspace_id": "default"})
    cols = [("cid", "INTEGER"), ("region", "VARCHAR"), ("amount", "DOUBLE"), ("d", "DATE")] if n == "Sales" else [("cid", "INTEGER"), ("name", "VARCHAR")]
    for c, t in cols:
        store.insert("columns_meta", {"dataset_id": d["id"], "name": c, "dtype": t})

EXACT = [
    "SELECT * FROM Sales",
    "SELECT * FROM Sales WHERE amount > 6 AND region = 'N' ORDER BY amount DESC LIMIT 5",
    "SELECT region, SUM(amount) AS total FROM Sales GROUP BY region ORDER BY total DESC",
    "SELECT region, COUNT(*) AS n, COUNT(DISTINCT cid) AS people FROM Sales GROUP BY 1",
    "SELECT region, SUM(amount) AS total FROM Sales GROUP BY region HAVING SUM(amount) > 20",
    "SELECT cid, amount * 2 AS double, SUM(amount) OVER (ORDER BY d) AS running FROM Sales",
    "SELECT s.region, c.name FROM Sales s JOIN Cust c ON s.cid = c.cid WHERE s.amount >= 7",
    "SELECT DATE_TRUNC('month', d) AS m, SUM(amount) AS t FROM Sales GROUP BY DATE_TRUNC('month', d) ORDER BY m",
    "SELECT region FROM Sales WHERE region = 'N' OR amount < 6",
]
WRAPPED = [
    "WITH x AS (SELECT * FROM Sales) SELECT * FROM x",
    "SELECT * FROM Sales UNION ALL SELECT * FROM Sales",
    "SELECT * FROM (SELECT * FROM Sales) q",
]
for sql in EXACT:
    r = sql_to_spec(sql)
    assert r["fidelity"] == "exact", (sql, r)
    a, b = engine.execute(sql, 100), engine.execute(compile_spec(r["spec"]), 100)
    assert a["columns"] == b["columns"] and sorted(map(repr, (tuple(x.values()) for x in a["rows"]))) == sorted(map(repr, (tuple(x.values()) for x in b["rows"]))), sql
for sql in WRAPPED:
    r = sql_to_spec(sql)
    assert r["fidelity"] == "wrapped" and r["spec"]["stages"][0]["sql"] == sql, (sql, r)
    assert engine.execute(compile_spec(r["spec"]), 100)["row_count"] == engine.execute(sql, 100)["row_count"]
# a wrapped query can be built on: a second stage that filters it
r = sql_to_spec(WRAPPED[0])
r["spec"]["stages"][1].update({"filters": [{"col": "amount", "op": ">", "value": 6}]})
assert engine.execute(compile_spec(r["spec"]), 100)["row_count"] == 3
print("qb import ok")
