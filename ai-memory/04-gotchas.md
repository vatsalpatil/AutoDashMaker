# 04 — Gotchas (symptom → cause → fix)

- `ModuleNotFoundError: pydantic_settings` when running `python backend/main.py` in VS Code → VS Code used global `C:/Python314`, not `backend/.venv` →
  use `backend\.venv\Scripts\python.exe` (select it as the VS Code interpreter) or `pip install -r backend/requirements.txt`.
  (Installing globally downgraded global fastapi 0.131→0.115 and starlette 0.52→0.38 because of pins.)
- Frontend gets 500s on /api → backend port != vite proxy target. Proxy default is now 8000 (`python backend/main.py`); for uvicorn on 8001 run `API_TARGET=http://127.0.0.1:8001 npm run dev`.
- Alert fails every poll with "cannot access local variable 'value'" → was a bug in `evaluate_alert` (read `value` before assignment); fixed by taking first col of first row from `engine.execute` result. Failures are only logged (`log.warning`) → check `backend/server_err.log` (grep, don't read whole).
- `engine.execute()` returns rows as **list of dicts** keyed by column name (not tuples) — index with `result["columns"][0]`.
- New DB column on an existing table → add an idempotent `ALTER TABLE` to `MIGRATIONS` in `core/store.py`; editing `SCHEMA` alone does not alter existing DB files.
- `store.list(..., order=None)` — pass `order=None` where there is no `created_at` ordering expectation (used by alert scheduler).
- Tests/scripts that import `app.services.*` load the config (via `services/__init__`) at import time → set `METADATA_DB`/`ANALYTICS_DB` env vars BEFORE the first `app` import, otherwise they write into the real `backend/data/*.duckdb` (happened once: test audit rows, cleaned up).
- `import app.services.engine as x` gives the `engine` OBJECT (shadowed by `services/__init__`); use `importlib.import_module("app.services.engine")` for the module.
- Writing to the analytics DB through `engine.connect()` will NOT invalidate the result cache — use `engine.writer()`.
- The live `metadata.duckdb` is locked while the app runs (can't copy/open it); seed throwaway copies with `git show HEAD:...` or stop the app.
- Cached `execute()` results hold `rows` as an immutable tuple; copy before mutating. Writing `\\b` regex escapes through heredoc-generated Python can silently become backspace characters — prefer the Edit tool for regexes.
- Multiple `__pycache__` for py311/312/314 exist → several Python versions have been used here; always use the venv.
- Connector/httpx error text can contain credentials (URL query keys, `user:pass@`) — always pass it through `core.security.redact_secrets()` before storing, logging or returning it; use `quote_ident()` for any column name put into SQL.
- Reasoning/'thinking' models (e.g. openrouter/free) may answer with a transcript instead of SQL; `services/ai.py::extract_sql/generate_sql` strips it and retries once, else raises a friendly AIError. They are also slow (~60 s) — prefer a non-reasoning model for the SQL assistant.
- AI SQL endpoints return status `not_a_query` (model replies NOT_A_QUERY for greetings) — handled in WorkbenchPage AiPanel and AskPage. `api.post(path, body, signal)` supports AbortController (Stop button); stopping only aborts the browser request, the backend model call finishes on its own.
- Never generate Python/code files through `python - <<EOF` heredocs when the content has `\n`, `\b` etc.: escapes get interpreted once and written as REAL newlines/backspaces (broke `services/ai.py` for seconds on the auto-reloading live backend; earlier a regex got backspace chars). Use the Write/Edit tools for code.
- AI SQL flow: `generate_sql` = extract → (retry if no SQL) → bind-check with `engine.check_sql` (EXPLAIN) → one repair call feeding the DB error back. Complex requests may use CTEs; Workbench "Add as step (CTE)" composes queries via `/queries/compose`.
- NOT_A_QUERY false positives: models called "edit this to only show the top 3" chit-chat. The shared rule now says edit instructions are valid; `/ai/sql` additionally retries once when the editor has SQL and the message matches `_EDIT_INTENT`. When adding `re`/other module use in a router, add the import — a missing one crashes the auto-reloading live backend.
- `npx shadcn init` OVERWRITES `src/lib/utils.ts` with `export { cn } from "cn"` (drops fmt/timeAgo) and rewrites index.css with its neutral palette — back both up first (`git checkout -- src/lib/utils.ts`; re-merge my token CSS). It also prompts interactively: use `yes y | npx shadcn@latest init -t vite -b base -p nova -f -y --no-reinstall`.
- ReUI needs the Base UI flavour: `components.json` `"style": "base-nova"` (Radix style → `render`/`delay` prop type errors). Generated files import `cn` from the npm package `cn`.
- Tailwind v4 renames (already applied): shadow→shadow-sm, shadow-sm→shadow-xs, rounded→rounded-sm, rounded-sm→rounded-xs, outline-none→outline-hidden. The `@tailwindcss/upgrade` tool fails on custom preflight imports — rename by hand. Restart the Vite dev server after the Tailwind/PostCSS change (old process keeps the v3 pipeline).
- Regex renames across source can hit identifiers (a helper named `shadow` was renamed) — review the diff.
- `POST /queries/run` SAVES the query by default (`save: true`) — pass `save:false` for previews/probes or every run adds a "saved query" row (the old ChartsPage did this).
- Bar/area charts must start at 0: recharts `domain ['auto','auto']` zooms to the data min. `CartesianChart` defaults the min to 0 for bar/area/combo.
- Multi-line code written through bash heredocs gets mangled by quoting — use the Write/Edit tools (or a Write-created script file) for anything with quotes or escapes.
- `useEffect(() => el?.scrollIntoView())` returns a value → "destroy is not a function"; always use a block body.
- Theme `mode: 'system'` with a light preset used to paint light colours under `.dark`; `applyPrefs` now resolves the preset's twin for the active mode.
- Free reasoning models echo `<placeholder>` formats literally and wrap SQL in thinking text — never trust prose; validate (`analyst._usable`) and fall back.
- Certificate files for DB connections: uploaded via `POST /api/sources/files` into `backend/uploads/certs/` (ext allow-list, 64 KB cap); connectors (`connectors/tls.py`) accept ONLY paths inside that folder. Source config stores `ssl_mode/ssl_ca/ssl_cert/ssl_key`. Cloud MySQL/TiDB usually needs `ssl_mode=REQUIRED` (or VERIFY_IDENTITY) + CA. Not tested against a live TLS server.
- TiDB (MySQL-compatible) rejects `START TRANSACTION READ ONLY`, which DuckDB's mysql ATTACH ... READ_ONLY opens on first query: `connectors/mysql.py::_attach` probes with SHOW TABLES and falls back to a plain attach (safe: only SELECTs run, all via validate_readonly).
- Linked datasets: a READ-ONLY main DuckDB connection makes DuckDB open `START TRANSACTION READ ONLY` on attached remotes (TiDB rejects it) → `engine._open` uses a normal connection when the SQL mentions a linked dataset (SQL is still validate_readonly-guarded). `describe_table` on a linked dataset samples 100 rows instead of profiling the table. `COUNT(*)` over the MySQL scanner fails → `MySQLConnector.count_rows` counts remotely via `mysql_query`.
- Tests must set ANALYTICS_DB / METADATA_DB / DUCKDB_TEMP_DIR (NOT DATA_DIR, which config ignores) before importing `app`, or they write into the real databases (test_analyst once left a stray `sales` table in the user's analytics DB — harmless, not a registered dataset; drop it when the server is stopped).
- The metadata DB can miss newly added columns if the startup migration did not run; `remote._load` self-heals with `ALTER ... ADD COLUMN IF NOT EXISTS` and must never block ordinary queries.
- Free reasoning models quote the output format before the real answer: JSON/SQL parsers must pick the LAST valid candidate (see `dash_ai.parse_json`), and plans need ~6000 tokens.
- `node --test tests/*.test.ts` runs frontend unit tests (Node 24 strips TS types); keep tested modules free of `@/` alias imports.
- `ResizablePanelGroup` uses `orientation="vertical"|"horizontal"` (react-resizable-panels v3+), not `direction`.
- ReUI DataGridScrollArea only scrolls if its viewport is capped too: index.css sets `max-height: inherit` on the viewport; without it a maxHeight grid clips rows and shows no vertical scrollbar. The browser pane does not run rAF/scroll events while hidden, so test with a stubbed requestAnimationFrame.
- ReUI `TreeItem` spreads the tree library's item props AFTER your props, so an `onClick` on TreeItem is silently overwritten; put click handlers on `TreeItemLabel` (Workbench explorer 'Preview first 100 rows' and column insert were dead because of this).
- The sidebar turns into an off-canvas drawer below 768px (md), not 640px (sm): the header SidebarTrigger must be visible exactly where the edge button is not, so both use the md breakpoint (hiding the trigger at sm left 640-767px windows with no way to open the menu).
- Base UI `DropdownMenuLabel` must sit inside a `DropdownMenuGroup` (else 'MenuGroupContext is missing' crashes the page). Base UI menus open on pointerdown: use the real click tool, not element.click(), when testing.
- `<SidebarProvider style={{'--sidebar-width': undefined}}>` WIPES the default width (the provider spreads your style over its own): the gap collapsed to 0 and the sidebar overlapped the page. Only pass the style when a width was saved.
- Python heredocs through bash: a literal `
` / `` in generated source gets mangled (real newline / control char). For code containing backslashes use the Write/Edit tools, not `python - <<EOF` string replacement.
- Testing a second backend against `backend/data/*.duckdb` fails on Windows with 'file is being used by another process' while the user's server runs: copy both DBs to `backend/scratch/` and set METADATA_DB/ANALYTICS_DB.
- Free reasoning models (OpenRouter nemotron) write their thinking BEFORE the JSON and can hit `max_tokens` before answering; always parse the LAST JSON object, give formula calls >= 2500 tokens, and salvage a stated 'Expression: `...`'. Don't validate with a scanning query on linked 1M-row tables (3-20 s): use `LIMIT 0` or skip when the schema already guarantees the columns.
- Testing against the real `backend/data/*.duckdb` while the dev server runs fails with a file-lock IO error (qb from-sql then reports 'wrapped'); use a temp DB like tests/test_qb_import.py or restart the server.

## Nixpacks + Caddy
Never add `caddy` to `nixPkgs` when the app has a Caddyfile: Nixpacks adds it itself and the duplicate fails with 'Unable to build profile. There is a conflict ... caddy-api.service'.

## Multi-user (tenant) rules
- System code (schedulers, threads) has no request, so no workspace: read rows under `tenant.all_workspaces()`, then run each in its owner's workspace with `tenant.run_as(row['workspace_id'], fn, ...)`. `engine` under all_workspaces() raises on purpose. `asyncio.to_thread` keeps the context; plain `Thread`/`ThreadPoolExecutor` do NOT: wrap with `tenant.bind(fn)`.
- Any module-level cache must be keyed by `tenant.current()` (attention, names already are) or one user's data leaks to another.
- New table = add `workspace_id TEXT DEFAULT 'ws_default'` (SCHEMA or MIGRATIONS). Raw `store.execute` is NOT scoped: add `WHERE workspace_id = ?` yourself.
- Never open files by a user-supplied path: use `netguard.confine_path`; never fetch a user-supplied URL with plain httpx: use `netguard.safe_client`.
- Test: `python tests/test_tenant.py` (two users, must stay green). `test_refresh` needs real data, `test_remote` needs DuckDB extension downloads (both fail in the sandbox, not bugs).
