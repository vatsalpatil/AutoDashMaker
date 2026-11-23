"""One query joins two different live databases and an uploaded table (DuckDB attaches every mentioned source).
Run: backend/.venv/Scripts/python.exe tests/test_cross_source.py"""
import os
import sqlite3
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
tmp = tempfile.mkdtemp()
os.environ.update(ANALYTICS_DB=os.path.join(tmp, "a.duckdb"), METADATA_DB=os.path.join(tmp, "m.duckdb"),
                  DUCKDB_TEMP_DIR=os.path.join(tmp, "s"), UPLOAD_DIR=os.path.join(tmp, "u"))

from app.core.store import store
from app.services import remote
from app.services.engine import engine


def sqlite_db(name: str, ddl: str, rows: list[tuple]) -> str:
    path = os.path.join(tmp, f"{name}.sqlite")
    db = sqlite3.connect(path)
    db.execute(ddl)
    db.executemany(f"INSERT INTO {name} VALUES ({','.join('?' * len(rows[0]))})", rows)
    db.commit(); db.close()
    return path


orders_db = sqlite_db("orders", "CREATE TABLE orders (order_id TEXT, customer_id TEXT, amount REAL)",
                      [("O1", "C1", 100.0), ("O2", "C2", 40.0), ("O3", "C1", 60.0)])
crm_db = sqlite_db("customers", "CREATE TABLE customers (customer_id TEXT, region TEXT)", [("C1", "North"), ("C2", "South")])
src1 = store.insert("datasources", {"name": "shop db", "type": "sqlite", "config": {"path": orders_db}})
src2 = store.insert("datasources", {"name": "crm db", "type": "sqlite", "config": {"path": crm_db}})
o = remote.link_source(src1, "orders", "orders_live")
c = remote.link_source(src2, "customers", "customers_live")
with engine.writer() as con:   # an uploaded file's table
    con.execute("CREATE TABLE ds_targets AS SELECT * FROM (VALUES ('North', 150.0), ('South', 50.0)) t(region, target)")

r = engine.execute(f"""
    SELECT cu.region, SUM(od.amount) AS revenue, MAX(t.target) AS target
    FROM {o['physical_name']} AS od
    JOIN {c['physical_name']} AS cu ON od.customer_id = cu.customer_id
    JOIN ds_targets AS t ON t.region = cu.region
    GROUP BY cu.region ORDER BY cu.region""")
rows = [tuple(x.values()) if isinstance(x, dict) else tuple(x) for x in r["rows"]]
assert rows == [("North", 160.0, 150.0), ("South", 40.0, 50.0)], rows
print("test_cross_source OK")
