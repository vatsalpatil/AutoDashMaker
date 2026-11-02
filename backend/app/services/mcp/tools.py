"""The tools the user's own AI sees over MCP. Each one is a thin call into the normal REST API (see server.py `Api`),
so every rule that guards the app (read-only SQL, workspace isolation, quotas, audit) applies unchanged.
`call_api` + `list_api_endpoints` reach everything else the app can do."""
from __future__ import annotations

from typing import Any, Awaitable, Callable

from ..chart_suggest import encode, suggest_chart

GUIDE = """Dashtor = Source -> Dataset -> Query (DuckDB SQL) -> Chart -> Dashboard -> Share/Present.
Typical flow:
1. list_datasets (or connect_source + list_source_tables + import_table to bring new data in).
2. describe_dataset to learn the table name and columns; the SQL table name is the dataset's `physical_name`.
3. run_sql to explore (read-only DuckDB SQL; SELECT/WITH only).
4. create_dashboard, then add_chart for each insight (give the SQL; chart type/encoding are optional, picked automatically).
   Chart types: bar line area composed scatter pie funnel treemap radar kpi histogram waterfall boxplot gauge progress
   sankey sunburst ranked table. encoding = {x: <column>, y: <column or [columns]>, color?: <column>}.
5. add_text for notes/headlines, share_dashboard for a public read-only link.
Anything else (alerts, reports, semantic metrics, quality, data tests, transforms, query builder...):
list_api_endpoints(filter) then call_api(method, path, body)."""

S = lambda props, req=(): {"type": "object", "properties": props, "required": list(req)}  # noqa: E731
STR, INT, OBJ = {"type": "string"}, {"type": "integer"}, {"type": "object"}
Api = Any  # server.Api (avoid an import cycle)


async def _add_chart(api: Api, a: dict) -> Any:
    spec = a.get("spec") or {}
    if not spec.get("type") or not spec.get("encoding"):
        res = await api.post("/api/queries/run", {"sql": a["sql"], "row_limit": 200, "save": False})
        cols, rows = res.get("columns") or [], res.get("rows") or []
        picked = suggest_chart(cols, rows, a["sql"])
        if spec.get("type"):
            picked = {"type": spec["type"], "encoding": encode(spec["type"], cols, rows), "options": {}}
        spec = {**picked, **{k: v for k, v in spec.items() if v}}
    body = {"name": a["name"], "sql": a["sql"], "spec": spec, "page": a.get("page") or "main"}
    return await api.post(f"/api/dashboards/{a['dashboard_id']}/widgets/new", body)


async def _share(api: Api, a: dict) -> Any:
    s = await api.post(f"/api/dashboards/{a['dashboard_id']}/shares", {"days": a.get("days", 30)})
    return {**s, "url": f"{api.public_url}/s/{s['token']}"}


async def _describe(api: Api, a: dict) -> Any:
    d = a["dataset_id"]
    return {"dataset": await api.get(f"/api/datasets/{d}"), "schema": await api.get(f"/api/datasets/{d}/schema"),
            "preview": await api.get(f"/api/datasets/{d}/preview", {"limit": 10})}


def _dataset_list(rows: Any) -> Any:  # the full rows are huge (quality, config...); the AI needs the essentials
    keep = ("id", "name", "physical_name", "table_name", "row_count", "source_id", "mode", "refreshed_at")
    return [{k: r.get(k) for k in keep if k in r} for r in rows] if isinstance(rows, list) else rows


Handler = Callable[[Api, dict], Awaitable[Any]]
TOOLS: list[tuple[str, str, dict, Handler, bool]] = [   # name, description, input schema, handler, read_only
    ("guide", "How Dashtor works and the recommended tool flow. Call this first.", S({}),
     lambda api, a: _const(GUIDE), True),
    ("list_sources", "List connected data sources (databases, files, APIs).", S({}),
     lambda api, a: api.get("/api/sources"), True),
    ("connect_source", "Connect a new data source. type: postgres | mysql | sqlite | rest | graphql | web | file. "
     "config holds the connection fields (e.g. host, port, database, user, password; or url for rest).",
     S({"name": STR, "type": STR, "config": OBJ}, ("name", "type")),
     lambda api, a: api.post("/api/sources", {"name": a["name"], "type": a["type"], "config": a.get("config") or {}}), False),
    ("list_source_tables", "List the tables/endpoints a source offers (to import).", S({"source_id": STR}, ("source_id",)),
     lambda api, a: api.get(f"/api/sources/{a['source_id']}/discover"), True),
    ("import_table", "Import a table from a source as a dataset. mode: copy (import rows) | link (query live).",
     S({"source_id": STR, "name": STR, "dataset_name": STR, "mode": STR}, ("source_id", "name")),
     lambda api, a: api.post("/api/datasets/ingest", {k: a[k] for k in ("source_id", "name", "dataset_name", "mode") if a.get(k)}), False),
    ("list_datasets", "List datasets (queryable tables) with their SQL table names.", S({}),
     lambda api, a: api.get("/api/datasets", transform=_dataset_list), True),
    ("describe_dataset", "Columns, types and 10 sample rows of one dataset.", S({"dataset_id": STR}, ("dataset_id",)),
     _describe, True),
    ("run_sql", "Run a read-only DuckDB SQL query over the datasets. Returns columns + rows.",
     S({"sql": STR, "row_limit": INT}, ("sql",)),
     lambda api, a: api.post("/api/queries/run", {"sql": a["sql"], "row_limit": min(int(a.get("row_limit") or 200), 2000), "save": False}), True),
    ("list_dashboards", "List dashboards.", S({}), lambda api, a: api.get("/api/dashboards"), True),
    ("get_dashboard", "A dashboard with its pages and widgets.", S({"dashboard_id": STR}, ("dashboard_id",)),
     lambda api, a: api.get(f"/api/dashboards/{a['dashboard_id']}"), True),
    ("create_dashboard", "Create an empty dashboard. pages: optional [{id, name}].",
     S({"name": STR, "description": STR, "pages": {"type": "array", "items": OBJ}}, ("name",)),
     lambda api, a: api.post("/api/dashboards", {k: a[k] for k in ("name", "description", "pages") if a.get(k)}), False),
    ("add_chart", "Add a chart to a dashboard from SQL. spec {type, encoding, options} is optional; omitted parts are chosen "
     "from the result. The SQL is run first, so a broken chart is never saved.",
     S({"dashboard_id": STR, "name": STR, "sql": STR, "spec": OBJ, "page": STR}, ("dashboard_id", "name", "sql")),
     _add_chart, False),
    ("add_text", "Add a markdown text/note widget to a dashboard.",
     S({"dashboard_id": STR, "title": STR, "markdown": STR, "page": STR}, ("dashboard_id", "markdown")),
     lambda api, a: api.post(f"/api/dashboards/{a['dashboard_id']}/widgets", {
         "kind": "text", "title": a.get("title") or "", "settings": {"content": a["markdown"]}, "page": a.get("page") or "main",
         "position": {"x": 0, "y": 1000, "w": 12, "h": 3}}), False),   # y past the end: the grid compacts it up to the bottom
    ("remove_widget", "Remove a widget from a dashboard.", S({"dashboard_id": STR, "widget_id": STR}, ("dashboard_id", "widget_id")),
     lambda api, a: api.request("DELETE", f"/api/dashboards/{a['dashboard_id']}/widgets/{a['widget_id']}"), False),
    ("share_dashboard", "Create a public read-only link to present a dashboard. days: expiry (0 = never).",
     S({"dashboard_id": STR, "days": INT}, ("dashboard_id",)), _share, False),
    ("list_api_endpoints", "Search every Dashtor API endpoint (method, path, summary). filter: words to match, e.g. 'alert'.",
     S({"filter": STR}), lambda api, a: _const(api.endpoints(a.get("filter", ""))), True),
    ("call_api", "Call any Dashtor API endpoint as the user. path starts with /api/. body = JSON for POST/PUT/PATCH; "
     "query = URL parameters.", S({"method": STR, "path": STR, "body": OBJ, "query": OBJ}, ("method", "path")),
     lambda api, a: api.request(a["method"], a["path"], a.get("body"), a.get("query")), False),
]


async def _const(v: Any) -> Any:
    return v
