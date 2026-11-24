"""Real SQL, end to end: each case goes through the read-only guard, name resolution and DuckDB, and must return the exact
answer. Catches anything that silently rewrites what the user wrote (the generic-dialect bug shifted list indexes and
dropped regexp_extract's group). Add a case whenever a query shape breaks. Run: backend/.venv/Scripts/python.exe tests/test_sql_cases.py"""
from helpers import isolated, make_dataset
isolated()

from app.routers.queries import QueryIn, run_query

make_dataset("emp", "SELECT * FROM (VALUES ('E1','Sales',100.0,'2025-01-05'::DATE,NULL), ('E2','Sales',300.0,'2025-02-10'::DATE,'E1'), "
                    "('E3','IT',200.0,'2025-02-20'::DATE,'E1'), ('E4','IT',400.0,'2025-03-01'::DATE,'E3')) t(id, dept, pay, hired, boss)")

CASES: list[tuple[str, list[dict]]] = [
    ("SELECT [10, 20, 30][1] AS a, [10, 20, 30][-1] AS b, [10, 20, 30][2:3] AS c", [{"a": 10, "b": 30, "c": [20, 30]}]),
    ("""SELECT regexp_extract('Supplier "7" Ltd', '"(\\d+)"', 1) AS n""", [{"n": "7"}]),
    ("SELECT dept, sum(pay) AS total FROM emp GROUP BY ALL ORDER BY dept", [{"dept": "IT", "total": 600.0}, {"dept": "Sales", "total": 400.0}]),
    ("SELECT id FROM emp QUALIFY row_number() OVER (PARTITION BY dept ORDER BY pay DESC) = 1 ORDER BY id", [{"id": "E2"}, {"id": "E4"}]),
    ("PIVOT (SELECT strftime(hired, '%Y-%m') AS m, dept, pay FROM emp) ON dept USING sum(pay) GROUP BY m ORDER BY m",
     None),   # shape checked below: one row per month, a column per department
    ("WITH RECURSIVE t AS (SELECT id, 0 AS depth FROM emp WHERE boss IS NULL UNION ALL "
     "SELECT e.id, t.depth + 1 FROM emp e JOIN t ON e.boss = t.id) SELECT max(depth) AS d FROM t", [{"d": 2}]),
    ("SELECT quantile_cont(pay, 0.5) AS med FROM emp", [{"med": 250.0}]),
    ("SELECT count(*) FILTER (WHERE pay > 150) AS n FROM emp", [{"n": 3}]),
    ("SELECT * EXCLUDE (boss, hired) FROM emp WHERE id = 'E1'", [{"id": "E1", "dept": "Sales", "pay": 100.0}]),
    ("SELECT 'it''s' AS s, 2 ** 3 AS p, 7 // 2 AS q", [{"s": "it's", "p": 8.0, "q": 3}]),
    ("SELECT strftime(hired, '%Y-%m') AS m, count(*) AS n FROM emp GROUP BY 1 ORDER BY 1",
     [{"m": "2025-01", "n": 1}, {"m": "2025-02", "n": 2}, {"m": "2025-03", "n": 1}]),
    ("FROM emp SELECT id WHERE pay = 400", [{"id": "E4"}]),
]

for sql, want in CASES:
    got = run_query(QueryIn(sql=sql, save=False))["rows"]
    got = [{k: (float(v) if type(v).__name__ == "Decimal" else v) for k, v in r.items()} for r in got]
    if want is None:
        assert len(got) == 3 and {"IT", "Sales"} <= set(got[0]), (sql, got)
    else:
        assert got == want, f"\n{sql}\n  got  {got}\n  want {want}"
print(f"test_sql_cases OK ({len(CASES)} cases)")
