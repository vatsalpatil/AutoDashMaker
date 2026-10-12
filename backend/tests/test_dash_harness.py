"""AI dashboard harness: self-review (critic), dashboard score, edit undo, new edit ops, overlap repair.
Run: backend/.venv/Scripts/python.exe tests/test_dash_harness.py"""
import json
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
tmp = tempfile.mkdtemp()
os.environ.update(ANALYTICS_DB=os.path.join(tmp, "a.duckdb"), METADATA_DB=os.path.join(tmp, "m.duckdb"), DUCKDB_TEMP_DIR=os.path.join(tmp, "spill"))

from app.core.store import store  # noqa: E402
from app.services import ai as ai_svc, dash_ai, dash_critic, dash_edit  # noqa: E402
from app.services.dash_place import resolve_overlaps  # noqa: E402
from app.services.engine import engine  # noqa: E402

with engine.writer() as con:
    con.execute("CREATE TABLE sales AS SELECT i AS id, CAST(i AS DOUBLE) AS amount, 'c' || (i % 40) AS cat, "
                "DATE '2024-01-01' + CAST(i % 30 AS INTEGER) AS d FROM range(1, 400) t(i)")

replies: list[str] = []
ai_svc.chat = lambda messages, provider_id=None, max_tokens=0, **_: replies.pop(0) if replies else "{}"

# 1. critic: a 40-slice pie becomes a bar, a multi-row KPI becomes a trend, an empty result is rewritten by the model
pie = dash_ai._materialize({"title": "Share", "type": "pie", "sql": "SELECT cat, SUM(amount) AS a FROM sales GROUP BY 1"}, "", None)
assert pie["chart"]["type"] == "bar" and "slices" in pie["notes"][0], pie["notes"]
kpi = dash_ai._materialize({"title": "Daily", "type": "kpi", "sql": "SELECT d, SUM(amount) AS a FROM sales GROUP BY 1 ORDER BY 1"}, "", None)
assert kpi["chart"]["type"] == "line", kpi["chart"]
replies[:] = [json.dumps({"title": "Total", "type": "kpi", "sql": "SELECT SUM(amount) AS total FROM sales"})]
fixed = dash_ai._materialize({"title": "Total", "type": "kpi", "sql": "SELECT SUM(amount) AS total FROM sales WHERE cat = 'zzz'"}, "", None)
assert fixed["all_rows"][0]["total"] > 0 and "rewrote" in fixed["notes"][0], fixed
try:   # still empty after the rewrite: refused, never saved
    dash_ai._materialize({"title": "None", "type": "table", "sql": "SELECT * FROM sales WHERE id < 0"}, "", None)
    raise SystemExit("expected ValueError")
except ValueError as e:
    assert "no rows" in str(e)

# 2. dashboard review: duplicates dropped, checklist + score
rev = dash_critic.review_dashboard([kpi, pie, {**pie, "title": "Share again"}], [], True)
assert rev["dropped"] == ["Share again"] and 0 < rev["score"] <= 100 and any(c["label"] == "Trend over time" and c["ok"] for c in rev["checks"])

# 3. edit: note, rename, add_page + add on it; then undo restores everything
dash = store.insert("dashboards", {"name": "Old", "pages": [{"id": "main", "name": "Overview"}]})
dash_ai._store_widget(dash["id"], pie, {"x": 0, "y": 0, "w": 6, "h": 4}, None)
ops = {"message": "ok", "next": ["Add a KPI"], "ops": [
    {"op": "rename", "name": "Sales cockpit"}, {"op": "note", "content": "Read me", "place": "top"},
    {"op": "add_page", "id": "detail", "name": "Detail"},
    {"op": "add", "widget": {"title": "Rows", "type": "table", "sql": "SELECT id, amount FROM sales LIMIT 5", "page": "detail"}}]}
replies[:] = [json.dumps(ops)]
out = dash_ai.edit_dashboard(dash["id"], "rename, add a note and a detail page", None)
assert len(out["applied"]) == 4 and out["can_undo"] and out["next"] == ["Add a KPI"], out
d = store.get("dashboards", dash["id"])
assert d["name"] == "Sales cockpit" and [p["id"] for p in d["pages"]] == ["main", "detail"]
pages = sorted(w.get("page") for w in store.list("dashboard_widgets", where="dashboard_id = ?", params=[dash["id"]], order=None))
assert pages == ["detail", "main", "main"], pages
dash_edit.undo(dash["id"])
d = store.get("dashboards", dash["id"])
assert d["name"] == "Old" and len(d["pages"]) == 1 and len(store.list("dashboard_widgets", where="dashboard_id = ?", params=[dash["id"]], order=None)) == 1

# 4. overlaps on a page are pushed below
idx = {"a": {"widget": {"page": "main", "position": {"x": 0, "y": 0, "w": 6, "h": 4}}},
       "b": {"widget": {"page": "main", "position": {"x": 3, "y": 2, "w": 6, "h": 4}}}}
assert resolve_overlaps(idx, "main") == [("b", 4)]
print("dash harness tests OK")
