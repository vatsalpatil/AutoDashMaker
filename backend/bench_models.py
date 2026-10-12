"""Benchmark self-hosted (Ollama) models on THIS machine with the app's real dashboard pipeline, and name the best one.

  python bench_models.py --url http://127.0.0.1:11434 --models qwen3.5:4b,qwen3.5:9b,gemma4:e4b
  (on the server: docker exec -it <backend container> python bench_models.py --url http://<ollama service>:11434 --models ...)

For each model it loads the weights, then runs understand -> plan -> build on a synthetic sales table and measures: generation and prompt
speed (tokens/second, from Ollama's own counters), seconds per phase, how many planned SQL queries were right on the FIRST try, how many
widgets ended up built (after the automatic repairs), insights, and suggestions. `--quick` stops after the plan (no insights). Everything
runs on throwaway databases; your real data is not touched.
"""
from __future__ import annotations

import argparse
import os
import sys
import tempfile
import time
from typing import Any

TMP = tempfile.mkdtemp(prefix="bench_")
os.environ.update(DASHTOR_ENV_FILE="", METADATA_DB=os.path.join(TMP, "m.duckdb"), ANALYTICS_DB=os.path.join(TMP, "a.duckdb"),
                  UPLOAD_DIR=os.path.join(TMP, "u"), DUCKDB_TEMP_DIR=os.path.join(TMP, "t"), DISK_USAGE_LIMIT_PCT="99")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.security import validate_readonly  # noqa: E402
from app.core.store import store  # noqa: E402
from app.services import dash_gen, dash_plan, ollama  # noqa: E402
from app.services.engine import engine  # noqa: E402


def make_dataset(rows: int) -> str:
    """A realistic sales table (dates, regions, products, measures) so the plan has something real to say."""
    with engine.writer() as con:
        con.execute(f"""CREATE TABLE sales AS SELECT i AS order_id, DATE '2023-01-01' + CAST(hash(i) % 900 AS INTEGER) AS order_date,
            ['North','South','East','West','Central'][1 + CAST(hash(i * 7) % 5 AS INTEGER)] AS region,
            ['Dark Bar','Milk Bar','Truffle Box','Praline Box','Hot Cocoa','Caramel Bites'][1 + CAST(hash(i * 11) % 6 AS INTEGER)] AS product,
            ['Bars','Boxes','Drinks','Snacks'][1 + CAST(hash(i * 13) % 4 AS INTEGER)] AS category,
            'C' || LPAD(CAST(hash(i * 17) % 4000 AS VARCHAR), 5, '0') AS customer_id,
            1 + CAST(hash(i * 19) % 12 AS INTEGER) AS quantity, ROUND(2 + (hash(i * 23) % 2000) / 100.0, 2) AS unit_price,
            [0, 0, 0.05, 0.1, 0.15][1 + CAST(hash(i * 29) % 5 AS INTEGER)] AS discount
            FROM range(1, {rows + 1}) t(i)""")
        con.execute("ALTER TABLE sales ADD COLUMN revenue DOUBLE")
        con.execute("UPDATE sales SET revenue = ROUND(quantity * unit_price * (1 - discount), 2)")
        con.execute("ALTER TABLE sales ADD COLUMN profit DOUBLE")
        con.execute("UPDATE sales SET profit = ROUND(revenue * (0.2 + (hash(order_id) % 30) / 100.0), 2)")
    return store.insert("datasets", {"name": "sales", "physical_name": "sales", "kind": "file", "row_count": rows})["id"]


def first_try_rate(widgets: list[dict[str, Any]]) -> float:
    """Share of the model's planned queries that are valid and bind to the real schema on the first attempt (no repairs)."""
    ok = 0
    for w in widgets:
        try:
            if engine.check_sql(validate_readonly(w.get("sql", ""), 1000)) is None:
                ok += 1
        except Exception:
            pass
    return ok / max(len(widgets), 1)


def timed(fn):
    t = time.time()
    out = fn()
    return out, time.time() - t


def run_model(model: str, url: str, ds_id: str, template: str, quick: bool) -> dict[str, Any]:
    pid = store.insert("ai_providers", {"label": model, "provider": "ollama", "model": model, "api_key": "", "base_url": url.rstrip("/") + "/v1", "is_default": False})["id"]
    cfg = {"model": model, "base_url": url}
    res: dict[str, Any] = {"model": model}
    try:
        _, res["load_s"] = timed(lambda: ollama.chat(cfg, [{"role": "user", "content": "Reply with OK"}], 8, 900))
        und_ev, res["understand_s"] = timed(lambda: list(dash_plan.understand(ds_id, template, "", pid)))
        und = next(e for e in und_ev if e["type"] == "understanding")
        res["questions"] = len(und["questions"])
        plan_ev, res["plan_s"] = timed(lambda: list(dash_plan.plan(ds_id, template, "", und["understanding"], {}, "", [], pid)))
        planned = plan_ev[-1]
        res["planned"] = len(planned["widgets"])
        res["first_try"] = first_try_rate(planned["widgets"])
        if not quick:
            done_ev, res["build_s"] = timed(lambda: list(dash_gen.build(ds_id, planned["name"], planned["pages"], planned["widgets"], pid)))
            done = done_ev[-1]
            built = [e for e in done_ev if e["type"] == "widget" and e["status"] == "ok"]
            res.update(built=len(built), fixed=sum(1 for e in built if e.get("fixed")), insights="Insights" in done["pages"], suggestions=len(done["suggestions"]))
    except Exception as e:   # a model that cannot finish the pipeline scores zero, with the reason
        res["error"] = str(e)[:160]
    st = ollama.STATS.get(model, {})
    res["gen_tps"] = st["tokens"] / st["gen_s"] if st.get("gen_s") else 0.0
    res["prefill_tps"] = st["prompt_tokens"] / st["prompt_s"] if st.get("prompt_s") else 0.0
    res["total_s"] = sum(res.get(k, 0) for k in ("understand_s", "plan_s", "build_s"))
    res["score"] = score(res, quick)
    return res


def score(r: dict[str, Any], quick: bool) -> float:
    """0-100: correctness first (first-try SQL, widgets built), then insights/suggestions, then speed. A model that errors scores 0."""
    if "error" in r or not r.get("planned"):
        return 0.0
    built = r["first_try"] if quick else r.get("built", 0) / max(r["planned"], 1)
    pts = 40 * r["first_try"] + 25 * built + (5 if r.get("questions") else 0)
    if not quick:
        pts += (10 if r.get("insights") else 0) + (5 if r.get("suggestions") else 0)
    else:
        pts += 15
    for limit, p in ((120, 15), (300, 11), (600, 7), (1200, 3)):
        if r["total_s"] <= limit:
            pts += p
            break
    return round(pts, 1)


def table(results: list[dict[str, Any]], quick: bool) -> str:
    head = ["model", "gen tok/s", "prefill tok/s", "load s", "understand s", "plan s", "build s", "total s", "planned", "1st-try SQL", "built", "fixed", "insights", "score"]
    rows = [head]
    for r in results:
        if "error" in r:
            rows.append([r["model"], "ERROR: " + r["error"]] + [""] * (len(head) - 2))
            continue
        rows.append([r["model"], f"{r['gen_tps']:.1f}", f"{r['prefill_tps']:.0f}", f"{r['load_s']:.0f}", f"{r['understand_s']:.0f}", f"{r['plan_s']:.0f}",
                     "-" if quick else f"{r['build_s']:.0f}", f"{r['total_s']:.0f}", str(r["planned"]), f"{r['first_try']:.0%}",
                     "-" if quick else str(r.get("built", 0)), "-" if quick else str(r.get("fixed", 0)), "-" if quick else ("yes" if r.get("insights") else "no"), f"{r['score']}"])
    widths = [max(len(row[i]) for row in rows) for i in range(len(head))]
    return "\n".join("  ".join(c.ljust(widths[i]) for i, c in enumerate(row)) for row in rows)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--url", default="http://127.0.0.1:11434", help="Ollama address (the service name inside Docker)")
    ap.add_argument("--models", required=True, help="comma-separated Ollama model tags")
    ap.add_argument("--rows", type=int, default=30000)
    ap.add_argument("--template", default="auto", choices=["auto", "executive", "performance", "explorer", "quality"])
    ap.add_argument("--quick", action="store_true", help="stop after the plan (about half the time, no insights)")
    a = ap.parse_args()
    ds_id = make_dataset(a.rows)
    results = []
    for m in [m.strip() for m in a.models.split(",") if m.strip()]:
        print(f"== {m} ...", flush=True)
        results.append(run_model(m, a.url, ds_id, a.template, a.quick))
        print(f"   done in {results[-1]['total_s']:.0f}s, score {results[-1]['score']}", flush=True)
    print("\n" + table(results, a.quick))
    best = max((r for r in results if "error" not in r), key=lambda r: (r["score"], -r["total_s"]), default=None)
    print(f"\nRecommended: {best['model']} (score {best['score']})" if best else "\nNo model finished the pipeline.")
    print("Score = 40% first-try SQL correctness + 25% widgets built + insights/questions + speed. Add the winner in Settings -> AI models (Ollama).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
