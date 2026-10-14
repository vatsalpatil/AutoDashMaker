"""SQL parameters: {{name|default}} placeholders filled safely. Run: python tests/test_sql_params.py"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import importlib.util  # noqa: E402

spec = importlib.util.spec_from_file_location("sql_params", os.path.join(os.path.dirname(__file__), "..", "app", "services", "sql_params.py"))
sp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sp)

SQL = "SELECT DATE_TRUNC('{{period|month}}', d) p, SUM(x) FROM t WHERE rate >= {{ min_rate | 30 }} GROUP BY 1"
assert sp.render(SQL) == "SELECT DATE_TRUNC('month', d) p, SUM(x) FROM t WHERE rate >= 30 GROUP BY 1"
assert "DATE_TRUNC('week'" in sp.render(SQL, {"period": "week", "min_rate": "12.5"}) and ">= 12.5" in sp.render(SQL, {"period": "week", "min_rate": "12.5"})
assert sp.render(SQL, {"period": ""}).startswith("SELECT DATE_TRUNC('month'")                 # empty -> default
assert sp.names(SQL) == [{"name": "period", "default": "month"}, {"name": "min_rate", "default": "30"}]
assert sp.render("SELECT 1") == "SELECT 1"
for evil in ["month'); DROP TABLE t; --", "x' OR '1'='1", "1; SELECT 2", "a/*", "a\\"]:
    try:
        sp.render(SQL, {"period": evil})
        raise AssertionError(f"accepted {evil!r}")
    except sp.ParamError:
        pass
try:
    sp.render("SELECT {{needs}}")
    raise AssertionError("missing value accepted")
except sp.ParamError:
    pass
print("PASS test_sql_params")
