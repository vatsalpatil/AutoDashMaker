"""Metadata database definition: table DDL and the idempotent column migrations applied at startup."""

SCHEMA = """
CREATE TABLE IF NOT EXISTS datasources (
    id TEXT PRIMARY KEY, organization_id TEXT, workspace_id TEXT, created_by TEXT,
    name TEXT, type TEXT, config TEXT, status TEXT DEFAULT 'active',
    created_at TIMESTAMP, updated_at TIMESTAMP
);
CREATE TABLE IF NOT EXISTS datasets (
    id TEXT PRIMARY KEY, organization_id TEXT, workspace_id TEXT, created_by TEXT,
    source_id TEXT, name TEXT, description TEXT DEFAULT '',
    kind TEXT,            -- file | table | api
    physical_name TEXT,   -- table name inside the analytics DuckDB
    row_count BIGINT, column_count INTEGER,
    created_at TIMESTAMP, updated_at TIMESTAMP
);
CREATE TABLE IF NOT EXISTS columns_meta (
    dataset_id TEXT, name TEXT, dtype TEXT, description TEXT DEFAULT '',
    null_pct DOUBLE, distinct_count BIGINT, sample_values TEXT,
    PRIMARY KEY (dataset_id, name)
);
CREATE TABLE IF NOT EXISTS queries (
    id TEXT PRIMARY KEY, organization_id TEXT, workspace_id TEXT, created_by TEXT,
    dataset_id TEXT, name TEXT, sql TEXT, status TEXT,
    row_count BIGINT, duration_ms DOUBLE, result_json TEXT,
    created_at TIMESTAMP
);
CREATE TABLE IF NOT EXISTS charts (
    id TEXT PRIMARY KEY, organization_id TEXT, workspace_id TEXT, created_by TEXT,
    query_id TEXT, dataset_id TEXT, name TEXT, spec TEXT,   -- declarative viz JSON
    created_at TIMESTAMP, updated_at TIMESTAMP
);
CREATE TABLE IF NOT EXISTS dashboards (
    id TEXT PRIMARY KEY, organization_id TEXT, workspace_id TEXT, created_by TEXT,
    name TEXT, description TEXT DEFAULT '', layout TEXT DEFAULT '[]',
    created_at TIMESTAMP, updated_at TIMESTAMP
);
CREATE TABLE IF NOT EXISTS dashboard_widgets (
    id TEXT PRIMARY KEY, dashboard_id TEXT, chart_id TEXT,
    position TEXT,  -- {x,y,w,h}
    refresh_policy TEXT DEFAULT 'manual',
    created_at TIMESTAMP
);
CREATE TABLE IF NOT EXISTS quality_runs (
    id TEXT PRIMARY KEY, dataset_id TEXT,
    completeness DOUBLE, uniqueness DOUBLE, validity DOUBLE,
    freshness TEXT, row_count BIGINT, duplicate_pct DOUBLE, details TEXT,
    created_at TIMESTAMP
);
CREATE TABLE IF NOT EXISTS ai_providers (
    id TEXT PRIMARY KEY, label TEXT, provider TEXT, model TEXT,
    api_key TEXT, base_url TEXT, is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP
);
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY, workspace_id TEXT, state TEXT DEFAULT '{}',
    created_at TIMESTAMP
);
CREATE TABLE IF NOT EXISTS user_contacts (
    user_id TEXT PRIMARY KEY, email TEXT, email_verified_at TIMESTAMP,
    phone TEXT, phone_verified_at TIMESTAMP, first_seen_at TIMESTAMP, updated_at TIMESTAMP
);
CREATE TABLE IF NOT EXISTS verification_codes (
    id TEXT PRIMARY KEY, user_id TEXT, channel TEXT, target TEXT, code_hash TEXT,
    attempts INTEGER DEFAULT 0, created_at TIMESTAMP, expires_at TIMESTAMP, consumed_at TIMESTAMP
);
CREATE TABLE IF NOT EXISTS metrics (
    id TEXT PRIMARY KEY, workspace_id TEXT, dataset_id TEXT,
    name TEXT, label TEXT, expression TEXT, filters TEXT DEFAULT '[]',
    description TEXT DEFAULT '', created_at TIMESTAMP, updated_at TIMESTAMP
);
CREATE TABLE IF NOT EXISTS dimensions (
    id TEXT PRIMARY KEY, workspace_id TEXT, dataset_id TEXT,
    name TEXT, label TEXT, column_name TEXT, description TEXT DEFAULT '',
    created_at TIMESTAMP
);
CREATE TABLE IF NOT EXISTS definitions (
    id TEXT PRIMARY KEY, workspace_id TEXT,
    term TEXT, definition TEXT, created_at TIMESTAMP
);
CREATE TABLE IF NOT EXISTS synonyms (
    id TEXT PRIMARY KEY, workspace_id TEXT,
    term TEXT, maps_to TEXT, created_at TIMESTAMP
);
CREATE TABLE IF NOT EXISTS verified_queries (
    id TEXT PRIMARY KEY, workspace_id TEXT, dataset_id TEXT,
    question TEXT, sql TEXT, metric_refs TEXT DEFAULT '[]',
    note TEXT DEFAULT '', created_at TIMESTAMP
);
CREATE TABLE IF NOT EXISTS feedback (
    id TEXT PRIMARY KEY, workspace_id TEXT, question TEXT, sql TEXT,
    verdict TEXT, reason TEXT DEFAULT '', detail TEXT DEFAULT '',
    created_at TIMESTAMP
);
CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY, workspace_id TEXT, dataset_id TEXT,
    name TEXT, metric_sql TEXT, operator TEXT, threshold DOUBLE,
    schedule_minutes INTEGER DEFAULT 60, channel TEXT DEFAULT 'in_app',
    active BOOLEAN DEFAULT TRUE,
    last_run_at TIMESTAMP, last_value DOUBLE, last_status TEXT DEFAULT 'ok',
    created_at TIMESTAMP
);
CREATE TABLE IF NOT EXISTS alert_runs (
    id TEXT PRIMARY KEY, alert_id TEXT, value DOUBLE, previous_value DOUBLE,
    status TEXT, message TEXT, created_at TIMESTAMP
);
CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY, workspace_id TEXT, name TEXT, sql TEXT,
    schedule_minutes INTEGER DEFAULT 1440, active BOOLEAN DEFAULT TRUE, webhook_url TEXT DEFAULT '',
    last_run_at TIMESTAMP, last_status TEXT DEFAULT 'never', last_rows INTEGER,
    created_at TIMESTAMP
);
CREATE TABLE IF NOT EXISTS report_runs (
    id TEXT PRIMARY KEY, report_id TEXT, status TEXT, row_count INTEGER,
    message TEXT DEFAULT '', file_name TEXT DEFAULT '', created_at TIMESTAMP
);
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY, workspace_id TEXT, alert_id TEXT,
    message TEXT, read BOOLEAN DEFAULT FALSE, created_at TIMESTAMP
);
CREATE TABLE IF NOT EXISTS relationships (
    id TEXT PRIMARY KEY, workspace_id TEXT,
    left_dataset_id TEXT, left_column TEXT,
    right_dataset_id TEXT, right_column TEXT,
    join_type TEXT DEFAULT 'left',   -- left | inner | full
    source TEXT DEFAULT 'manual',    -- manual | suggested
    created_at TIMESTAMP
);
CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY, workspace_id TEXT, actor TEXT,
    action TEXT,        -- query.run | ai.ask | dataset.ingest | dataset.delete | source.create | ...
    entity_type TEXT, entity_id TEXT, detail TEXT,
    status TEXT DEFAULT 'ok', duration_ms DOUBLE, created_at TIMESTAMP, updated_at TIMESTAMP
);
"""

# Columns added after the first release — applied idempotently on startup.
MIGRATIONS = [
    "ALTER TABLE datasets ADD COLUMN expected_interval_minutes INTEGER",
    "ALTER TABLE datasets ADD COLUMN refreshed_at TIMESTAMP",
    "ALTER TABLE datasets ADD COLUMN layers TEXT",  # JSON transform pipeline for derived datasets
    "ALTER TABLE dashboards ADD COLUMN pages TEXT",  # JSON [{id, name}]
    "ALTER TABLE datasets ADD COLUMN base_dataset_id TEXT",  # for derived datasets
    "ALTER TABLE dashboard_widgets ADD COLUMN page TEXT DEFAULT 'main'",
    "ALTER TABLE dashboard_widgets ADD COLUMN settings TEXT",
    "ALTER TABLE dashboard_widgets ADD COLUMN kind TEXT DEFAULT 'chart'",  # chart | section | text | link | iframe
    "ALTER TABLE dashboard_widgets ADD COLUMN title TEXT",
    "ALTER TABLE datasets ADD COLUMN auto_refresh BOOLEAN DEFAULT FALSE",  # opt-in scheduled refresh
    "ALTER TABLE datasets ADD COLUMN last_refresh_error TEXT",
    "ALTER TABLE datasets ADD COLUMN remote_table TEXT",  # set => linked (live) dataset: schema only, rows stay remote
    "ALTER TABLE audit_log ADD COLUMN updated_at TIMESTAMP",  # tables created before this column existed
    # per-user isolation: every table carries workspace_id (existing rows belong to the legacy default workspace)
    *[f"ALTER TABLE {t} ADD COLUMN workspace_id TEXT DEFAULT 'ws_default'"
      for t in ("columns_meta", "dashboard_widgets", "quality_runs", "ai_providers", "alert_runs", "report_runs")],
]
