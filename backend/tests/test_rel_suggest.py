"""Relationship suggestions: real keys only (not every shared column name), values must overlap, same folder first.
Run: backend/.venv/Scripts/python.exe tests/test_rel_suggest.py"""
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
tmp = tempfile.mkdtemp()
os.environ.update(METADATA_DB=tmp + "/m.duckdb", ANALYTICS_DB=tmp + "/a.duckdb", UPLOAD_DIR=tmp + "/up", DUCKDB_TEMP_DIR=tmp + "/s")

from app.core.store import store
from app.services import rel_suggest
from app.services.engine import engine

with engine.writer() as con:
    con.execute("CREATE TABLE ds_dept AS SELECT * FROM (VALUES ('D1','North'),('D2','South')) t(dept_id, region)")
    con.execute("CREATE TABLE ds_emp AS SELECT * FROM (VALUES ('E1','D1','North',10.5),('E2','D2','South',3.0),('E3','D1','North',3.0)) t(emp_id, dept_id, region, hours)")
    con.execute("CREATE TABLE ds_other AS SELECT * FROM (VALUES ('X9','North',3.0)) t(dept_id, region, hours)")   # same names, no shared ids


def ds(name, table, rows, folder, cols):
    d = store.insert("datasets", {"name": name, "physical_name": table, "row_count": rows, "folder": folder, "kind": "file"})
    for n, t, dc in cols:
        store.insert("columns_meta", {"dataset_id": d["id"], "name": n, "dtype": t, "distinct_count": dc})
    return d


ds("dept", "ds_dept", 2, "HR", [("dept_id", "VARCHAR", 2), ("region", "VARCHAR", 2)])
ds("emp", "ds_emp", 3, "HR", [("emp_id", "VARCHAR", 3), ("dept_id", "VARCHAR", 2), ("region", "VARCHAR", 2), ("hours", "DOUBLE", 2)])
with engine.writer() as con:   # a unique price shared by two tables is not a key
    con.execute("CREATE TABLE ds_p1 AS SELECT range AS unit_cost FROM range(30)")
    con.execute("CREATE TABLE ds_p2 AS SELECT range AS unit_cost FROM range(30)")
ds("p1", "ds_p1", 30, "A", [("unit_cost", "BIGINT", 30)])
ds("p2", "ds_p2", 30, "B", [("unit_cost", "BIGINT", 30)])
ds("other", "ds_other", 1, "Sales", [("dept_id", "VARCHAR", 1), ("region", "VARCHAR", 1), ("hours", "DOUBLE", 1)])
ds("dept", "ds_dept", 2, "HR", [("dept_id", "VARCHAR", 2), ("region", "VARCHAR", 2)])   # same file uploaded twice
with engine.writer() as con:   # two fact tables sharing a non-unique customer_id: many-to-many, not a join key
    con.execute("CREATE TABLE ds_subs AS SELECT * FROM (VALUES ('C1'),('C1'),('C2')) t(customer_id)")
    con.execute("CREATE TABLE ds_use AS SELECT * FROM (VALUES ('C1'),('C2'),('C2')) t(customer_id)")
ds("subs", "ds_subs", 3, "S", [("customer_id", "VARCHAR", 2)])
ds("use", "ds_use", 3, "S", [("customer_id", "VARCHAR", 2)])
store.insert("datasets", {"name": "blend", "physical_name": "ds_emp", "row_count": 3, "kind": "blend"})

pairs = [(s["left_dataset"], s["left_column"], s["right_dataset"], s["right_column"]) for s in rel_suggest.suggest()]
assert pairs == [("dept", "dept_id", "emp", "dept_id")] * 2, pairs   # each dept copy -> emp; never dept<->dept or subs<->use   # not region/hours (not keys), not other.dept_id (no shared values), not the blend
print("test_rel_suggest OK")
