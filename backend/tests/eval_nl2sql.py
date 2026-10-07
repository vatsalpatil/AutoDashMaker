"""NL→SQL evaluation: ask the live analyst a fixed set of questions over the sample sales data and compare each
answer with a hand-written reference query. Use it to compare AI models and catch regressions after prompt changes.

Not part of the unit-test suite (it needs a configured AI provider and takes minutes). Run it against the running server:

    backend/.venv/Scripts/python.exe tests/eval_nl2sql.py [--limit N] [--url http://localhost:8000] [--dataset <id>]

It reads `ds_sample_sales` (order_id, order_date, region, product, amount, status) and writes tests/eval_report.json.
"""
import argparse
import json
import math
import sys
import time

import httpx

TABLE = "ds_sample_sales"
CASES = [
    ("What is the total amount?", f"SELECT SUM(amount) FROM {TABLE}"),
    ("How many orders are there?", f"SELECT COUNT(*) FROM {TABLE}"),
    ("Total amount by region", f"SELECT region, SUM(amount) FROM {TABLE} GROUP BY region"),
    ("Which region has the highest total amount?", f"SELECT region FROM {TABLE} GROUP BY region ORDER BY SUM(amount) DESC LIMIT 1"),
    ("Number of orders per product", f"SELECT product, COUNT(*) FROM {TABLE} GROUP BY product"),
    ("Average order amount", f"SELECT AVG(amount) FROM {TABLE}"),
    ("Top 3 products by total amount", f"SELECT product FROM {TABLE} GROUP BY product ORDER BY SUM(amount) DESC LIMIT 3"),
    ("How many distinct products are sold?", f"SELECT COUNT(DISTINCT product) FROM {TABLE}"),
    ("Total amount of refunded orders", f"SELECT SUM(amount) FROM {TABLE} WHERE status = 'refunded'"),
    ("Number of orders per status", f"SELECT status, COUNT(*) FROM {TABLE} GROUP BY status"),
    ("Largest single order amount", f"SELECT MAX(amount) FROM {TABLE}"),
    ("Total amount per month", f"SELECT strftime(order_date, '%Y-%m'), SUM(amount) FROM {TABLE} GROUP BY 1"),
    ("Which product has the most orders?", f"SELECT product FROM {TABLE} GROUP BY product ORDER BY COUNT(*) DESC LIMIT 1"),
    ("Average amount per region", f"SELECT region, AVG(amount) FROM {TABLE} GROUP BY region"),
    ("How many orders in the West region?", f"SELECT COUNT(*) FROM {TABLE} WHERE region = 'West'"),
    ("Total amount for orders over 100", f"SELECT SUM(amount) FROM {TABLE} WHERE amount > 100"),
    ("Region and product with the highest total amount", f"SELECT region, product FROM {TABLE} GROUP BY 1, 2 ORDER BY SUM(amount) DESC LIMIT 1"),
    ("Percentage of orders that are refunded", f"SELECT 100.0 * SUM(CASE WHEN status = 'refunded' THEN 1 ELSE 0 END) / COUNT(*) FROM {TABLE}"),
    ("Earliest and latest order date", f"SELECT MIN(order_date), MAX(order_date) FROM {TABLE}"),
    ("Orders per region sorted from most to least", f"SELECT region, COUNT(*) FROM {TABLE} GROUP BY region ORDER BY 2 DESC"),
]


def norm(v):
    """Comparable form of a cell: floats rounded, everything else as text."""
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        return round(float(v), 2)
    return str(v)


def table(result):
    """Result rows as a sorted list of value tuples, so column names and row order do not matter."""
    cols = result["columns"]
    rows = [tuple(norm(r[c]) for c in cols) for r in result["rows"]]
    return sorted(rows, key=lambda t: tuple(str(x) for x in t))


def same(a, b):
    if len(a) != len(b):
        return False
    for ra, rb in zip(a, b):
        # the AI may return extra columns (e.g. both region and total): every reference value must appear in the row
        if not all(v in ra or any(isinstance(x, float) and isinstance(v, float) and math.isclose(x, v, abs_tol=0.011) for x in ra) for v in rb):
            return False
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://localhost:8000")
    ap.add_argument("--limit", type=int, default=len(CASES))
    ap.add_argument("--dataset", default=None, help="restrict the analyst to one dataset id (default: all tables)")
    args = ap.parse_args()

    client = httpx.Client(base_url=args.url, timeout=300)
    report, passed = [], 0
    for question, reference in CASES[: args.limit]:
        t0 = time.time()
        row = {"question": question, "ok": False, "seconds": 0, "sql": None, "error": None}
        try:
            want = client.post("/api/queries/run", json={"sql": reference, "save": False}).json()
            if "detail" in want:
                raise RuntimeError(f"reference failed: {want['detail']}")
            got = client.post("/api/ai/chat", json={"question": question, "dataset_id": args.dataset, "history": []}).json()
            row["sql"] = got.get("sql")
            if got.get("status") != "ok":
                row["error"] = f"{got.get('status')}: {got.get('detail')}"
            else:
                row["ok"] = same(table(got["result"]), table(want))
        except Exception as e:  # keep going: one bad case must not hide the others
            row["error"] = str(e)[:200]
        row["seconds"] = round(time.time() - t0, 1)
        passed += row["ok"]
        report.append(row)
        print(f"{'PASS' if row['ok'] else 'FAIL'}  {row['seconds']:>6}s  {question}" + (f"   <- {row['error']}" if row["error"] else ""), flush=True)

    total = len(report)
    print(f"\n{passed}/{total} correct ({100 * passed // max(total, 1)}%), mean {sum(r['seconds'] for r in report) / max(total, 1):.1f}s per question")
    out = __file__.replace("eval_nl2sql.py", "eval_report.json")
    json.dump({"passed": passed, "total": total, "cases": report}, open(out, "w"), indent=2)
    print("report:", out)
    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())
