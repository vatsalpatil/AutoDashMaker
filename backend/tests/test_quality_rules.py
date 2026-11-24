"""Data Quality validity rules find real problems (mixed date formats, numbers as text, negative stock, -999
placeholders, case variants) and score clean data 100. Run: backend/.venv/Scripts/python.exe tests/test_quality_rules.py"""
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
tmp = tempfile.mkdtemp()
os.environ.update(METADATA_DB=tmp + "/m.duckdb", ANALYTICS_DB=tmp + "/a.duckdb", UPLOAD_DIR=tmp + "/up", DUCKDB_TEMP_DIR=tmp + "/s")

from app.core.store import store
from app.services.engine import engine
from app.services.quality import run_quality_check

with engine.writer() as con:
    con.execute("""CREATE TABLE ds_messy AS SELECT * FROM (VALUES
        ('2025-01-02', '10', 5, 1.5, 'Present'), ('2025-01-03', '12', -3, -999, 'present'),
        ('03/01/2025', 'n/a', 7, 2.0, 'Present'), ('2025-01-05', '1,200', 2, 4.0, 'Leave'),
        ('2025-01-06', '8', 1, 2.5, 'Leave'), ('2025-01-07', '9', 4, 3.0, 'Leave'),
        ('2025-01-08', '9', 4, 3.0, 'Leave'), ('2025-01-09', '9', 4, 3.0, 'Leave'),
        ('2025-01-10', '9', 4, 3.0, 'Leave'), ('2025-01-11', '9', 4, 3.0, 'Leave'),
        ('2025-01-12', '9', 4, 3.0, 'Leave')) t(day, amount_txt, on_hand, reading, status)""")
    con.execute("CREATE TABLE ds_clean AS SELECT range AS id, range * 2 AS qty, 'A' AS kind FROM range(50)")
messy = store.insert("datasets", {"name": "messy", "physical_name": "ds_messy", "row_count": 11})
clean = store.insert("datasets", {"name": "clean", "physical_name": "ds_clean", "row_count": 50})

run = run_quality_check(messy)
found = {(i["column"], i["problem"].split(" ")[0]) for i in run["details"]["issues"]}
assert ("day", "mixed") in found, found
assert ("amount_txt", "numbers") in found, found
assert ("on_hand", "negative") in found, found
assert ("reading", "placeholder") in found, found
assert ("status", "same") in found, found
assert run["validity"] < 80, run["validity"]
bad_example = next(i for i in run["details"]["issues"] if i["column"] == "amount_txt")["example"]
assert bad_example == "n/a", bad_example                         # '1,200' counts as a number

ok = run_quality_check(clean)
assert ok["validity"] == 100 and ok["details"]["issues"] == [], ok
print("test_quality_rules OK")
