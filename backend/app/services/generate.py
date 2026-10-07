"""One-click dashboard generation from a dataset (§22).

Deterministic widget selection from the schema profile:
  - a "Records" KPI (row count) so a dashboard is never empty, plus one KPI per numeric measure (first two)
  - a time-series line chart if a date column exists (measure, or record count when there is no measure)
  - a bar chart of the top categorical dimension (measure, or record count)
  - a pie of the second categorical dimension (if present)
Each widget records *why* it was selected.
"""
from __future__ import annotations

from typing import Any

from ..core.store import store
from .engine import engine


def _is_num(dtype: str) -> bool:
    return any(t in dtype.upper() for t in ("INT", "DOUBLE", "FLOAT", "DECIMAL", "NUMERIC", "REAL"))


def _is_float(dtype: str) -> bool:
    return any(t in dtype.upper() for t in ("DOUBLE", "FLOAT", "DECIMAL", "NUMERIC", "REAL"))


def _is_date(dtype: str) -> bool:
    return any(t in dtype.upper() for t in ("DATE", "TIME"))


def _looks_like_id(c: dict, row_count: int) -> bool:
    """Identifiers are never measures: by name, or near-unique INTEGER/text values.

    Decimal columns are NOT judged by uniqueness: a continuous measure (amount, price) is almost always unique
    per row, and treating it as an id left datasets with no KPIs at all."""
    name = c["name"].lower()
    if name.endswith(("_id", "_key", "_uuid")) or name == "id":
        return True
    return (not _is_float(c["dtype"])) and row_count > 0 and c["distinct_count"] >= row_count * 0.98


def generate_dashboard(dataset: dict[str, Any], name: str | None = None) -> dict[str, Any]:
    table = dataset["physical_name"]
    schema = engine.describe_table(table)
    cols = schema["columns"]
    total = schema["row_count"]

    numeric = [c for c in cols if _is_num(c["dtype"]) and not _looks_like_id(c, total)]
    dates = [c for c in cols if _is_date(c["dtype"])]
    cats = [c for c in cols if not _is_num(c["dtype"]) and not _is_date(c["dtype"])
            and 1 < c["distinct_count"] <= 30]
    # what the charts aggregate: the first measure, or the number of records when the data has no measure
    if numeric:
        measure_name, agg = numeric[0]["name"], f'ROUND(SUM("{numeric[0]["name"]}"), 2)'
    else:
        measure_name, agg = "records", "COUNT(*)"

    dash = store.insert("dashboards", {
        "name": name or f"{dataset['name']} — auto overview",
        "description": f"Auto-generated from {dataset['name']}. "
                       "Widgets selected from the schema profile.",
    })
    created = []

    def add_widget(chart_name: str, sql: str, spec: dict, pos: dict, why: str):
        q = store.insert("queries", {"dataset_id": dataset["id"], "name": chart_name,
                                     "sql": sql, "status": "ok"})
        ch = store.insert("charts", {"query_id": q["id"], "dataset_id": dataset["id"],
                                     "name": chart_name, "spec": spec})
        store.insert("dashboard_widgets", {"dashboard_id": dash["id"], "chart_id": ch["id"],
                                           "position": pos})
        created.append({"chart": chart_name, "why": why})

    # KPI row: record count first (always available), then up to two measures
    kpis = [("Records", "COUNT(*)", "records", "number of rows — headline KPI")] + [
        (f"Total {c['name']}", f'ROUND(SUM("{c["name"]}"), 2)', f"total_{c['name']}",
         f"'{c['name']}' is a numeric measure — headline KPI") for c in numeric[:2]]
    width = 12 // len(kpis)
    for i, (title, expr, alias, why) in enumerate(kpis):
        add_widget(title, f"SELECT {expr} AS {alias} FROM {table}",
                   {"type": "kpi", "encoding": {"x": alias, "y": alias}, "options": {"numberFormat": "compact"}},
                   {"x": i * width, "y": 0, "w": width, "h": 2}, why)
    y_pos = 2

    # time series over the first date column
    if dates:
        d = dates[0]
        add_widget(
            f"{measure_name} over time",
            f'SELECT "{d["name"]}" AS {d["name"]}, {agg} AS {measure_name} FROM {table} GROUP BY 1 ORDER BY 1',
            {"type": "line", "encoding": {"x": d["name"], "y": measure_name}},
            {"x": 0, "y": y_pos, "w": 12, "h": 4},
            f"'{d['name']}' is temporal — trend of {measure_name} over time",
        )
        y_pos += 4

    # bar for top categorical
    if cats:
        c = cats[0]
        add_widget(
            f"{measure_name} by {c['name']}",
            f'SELECT "{c["name"]}" AS {c["name"]}, {agg} AS {measure_name} '
            f'FROM {table} GROUP BY 1 ORDER BY 2 DESC LIMIT 15',
            {"type": "bar", "encoding": {"x": c["name"], "y": measure_name}},
            {"x": 0, "y": y_pos, "w": 6, "h": 4},
            f"'{c['name']}' has {c['distinct_count']} categories — ranked comparison",
        )

    # pie for second categorical
    if len(cats) > 1:
        c = cats[1]
        add_widget(
            f"{measure_name} share by {c['name']}",
            f'SELECT "{c["name"]}" AS {c["name"]}, {agg} AS {measure_name} '
            f'FROM {table} GROUP BY 1 ORDER BY 2 DESC LIMIT 8',
            {"type": "pie", "encoding": {"x": c["name"], "y": measure_name}},
            {"x": 6, "y": y_pos, "w": 6, "h": 4},
            f"'{c['name']}' composition — share of total",
        )

    return {"dashboard_id": dash["id"], "name": dash["name"], "widgets": created}
