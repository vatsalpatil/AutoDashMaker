# Connections: types, control and management

Status 2026-11-24. "Done" = live on Dashtor_First; "Next" = designed, not built.

## 1. Connection types and how each becomes a table
| Type | How data arrives | Refresh meaning | State |
|---|---|---|---|
| File upload (CSV/TSV/JSON/Parquet/Excel) | one-time upload | re-upload | Done |
| File URL / Google Sheets | download → read like a file | re-download | Done (unique file per URL since this change) |
| REST / JSON API | request(s) → find record array → flatten | re-fetch all pages | Done; **pagination added** (auto: next link, cursor, skip/limit) |
| GraphQL | one POST {query, variables} | re-run query | Done (no paging; cursor paging = Next) |
| WebSocket stream | **bounded capture**: N messages or S seconds | new snapshot replaces old | **Added** |
| Postgres / MySQL / SQLite | copy, or *link* (live view, no rows copied) | re-copy / always live | Done |
| Webhook push (source POSTs to us) | append rows on each call | n/a (push) | Next |
| Kafka / MQTT / SSE | persistent consumer | continuous | Next (needs worker, see §4) |

Rule: **every connector implements one contract** (`connectors/base.py`: test_connection, discover, ingest; databases add attach/link).
A new type = one class + one registry line + one frontend schema entry (`sourceSchemas.ts`). The router takes its allowed
type list from the registry, so nothing else changes.

## 2. Controls that exist today (all types)
- **Network guard** (hosted mode): only public hosts; private/loopback/metadata IPs blocked, also via redirects and next-page links (`core/netguard.py`, `safe_client`). WebSocket checks ws/wss + public host.
- **Bounded work**: REST ≤ 50 pages by default (cap 500) and ≤ 1M rows; stops when an API repeats a page; WebSocket ≤ 60 s and ≤ 50k messages; downloads 60 s timeout; DB copies run in the copy worker.
- **Retries**: GET retried 3× with backoff on network/429/5xx; POST never replayed.
- **Auto-refresh backoff**: failing sources back off 5 min → 6 h; last error stored on the dataset (`services/refresh.py`).
- **Secrets**: masked in API replies (`secret_fields.public_source`), restored on edit, redacted from every error (`ConnectorError`).
- **Quotas**: dataset count / rows / storage per account, admin per-user overrides; 409 `quota.limit`.
- **Audit**: source create/update/delete logged.
- **Health view**: `/api/sources/health` live-tests every source in parallel (10 s cap) + freshness + last error.

## 3. Gaps found while testing, and the design for each (Next)
1. **Run history per source.** Today only the *last* error is kept. Add `source_runs(id, source_id, dataset_id, started_at,
   ms, rows, pages, bytes, ok, error)`, written by ingest/refresh; show a sparkline + last 20 runs on the source card.
   Makes "why is my dashboard stale" answerable.
2. **Incremental loads.** Every refresh re-fetches everything. Add `load_mode`: `replace` (today) | `append` (streams,
   logs: keep history, with a retention of N days/rows) | `upsert` (key column + watermark column, e.g. `updated_at >
   last max`). Streams in `append` mode turn snapshots into a time series.
3. **Per-source rate budget.** A source config gets `min_interval_minutes` (admin floor, e.g. 15 min hosted) and
   `max_requests_per_run`; the refresh loop refuses schedules below the floor. Stops one user hammering an API from our IP.
4. **Admin control of types.** `admin_settings.allowed_source_types` (e.g. hosted free plan: no database links, no
   streams) checked by the same `_known_type`; per-user override like the dataset limit.
5. **Failure → alert.** After 3 failed refreshes in a row, create a notification (existing attention/alerts feed), and
   pause auto-refresh after 10 so a dead source stops costing work.
6. **Schema drift.** On refresh compare new columns with `columns_meta`: added = note, removed/renamed = warning on
   dependent dashboards/queries before replacing the table (keep the old table until confirmed).
7. **Secrets at rest.** Encrypt `config` secret fields with a server key (Fernet) instead of plain JSON in the store.

## 4. Real-time streams (beyond snapshots)
Snapshots cover dashboards that refresh every few minutes. True live data needs a **stream worker**: one asyncio task per
active stream source, appending micro-batches (every 5 s or 500 msgs) into an append-only table with retention, with
the same caps per account (max active streams, max msgs/min). Dashboards poll the table; no new query path is needed.
Build it only when a user needs sub-minute data; until then the snapshot connector + auto-refresh is enough.
