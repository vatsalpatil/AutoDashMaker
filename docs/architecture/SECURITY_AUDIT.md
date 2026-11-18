# Security Audit — 2026-11-18 (branch Dashtor_First)

Scope: JWT validation, admin protection, per-workspace isolation, SQL guard, SSRF in connectors/proxies,
secret exposure, rate limits, CORS. Regression suite: `backend/tests/test_isolation_security.py`.
Line numbers refer to the tree after this audit's fixes.

## What was already solid
- **Isolation model**: one workspace per user (`core/tenant.py`), ContextVar pinned in `core/auth.py::require_user`;
  `core/store.py::_scoped` (l.137) ANDs `workspace_id` onto every `list/get/update/delete`, `insert` (l.73) forces it.
  Each workspace has its **own DuckDB instance/file** (`tenant.analytics_path`), so catalog-qualified names
  (`other.main.t`) cannot reach another user's tables. Verified by `test_tenant.py` + new cross-workspace checks.
- **SQL guard** (`core/security.py::validate_readonly`): sqlglot single-statement, DDL/DML/ATTACH/COPY/PRAGMA/SET/Command
  forbidden; with auth on, only plain table identifiers and a function deny-list. 24 bypass attempts (file literals,
  `FROM 'x.csv'`, CTE/subquery file reads, `read_*`, `glob`, `getenv`, `current_setting`, multi-statement, comments,
  INSTALL/LOAD, s3 URLs, `duckdb_secrets`, `query_table`, path traversal to other workspaces' parquet) are all blocked.
- **Share links**: secret token, IP brute-force throttle (`routers/shares.py::_open`), public payload strips SQL/table names.
- **Secrets**: `redact_secrets` on connector errors; provider keys sealed (`core/secrets_box.py`); `test_secrets`/`test_redact` pass.
- **CORS** (`backend/Main.py:48-53`): explicit origin list, no `allow_credentials` (bearer tokens, not cookies) — OK.
- **File sources**: `netguard.confine_path` restricts to the caller's upload folder when auth is on.

## Findings

| # | Sev | Finding | Location | Status |
|---|-----|---------|----------|--------|
| 1 | High | JWT `exp` not required: a validly signed token without `exp` never expired. | `core/auth.py:52` | **Fixed** (`options.require=[exp, sub]`) |
| 2 | Medium | JWT algorithm taken from the unverified header with no allow-list (alg-confusion surface: `HS384/512`, `none` reach the JWKS path). | `core/auth.py:17,43` | **Fixed** (`_ALGS = HS256/RS256/ES256`) |
| 3 | High | SSRF guard missed non-global ranges: CGNAT `100.64.0.0/10`, IPv4-mapped IPv6 (`::ffff:127.0.0.1`, `::ffff:a9fe:a9fe` = metadata), NAT64/6to4 embeddings. | `core/netguard.py:26` | **Fixed** (`not is_global` + embedded-IPv4 check) |
| 4 | High | AI provider custom `base_url` was never SSRF-checked: any user could point “test provider”/chat at `http://169.254.169.254/…` or internal services and read error/response text. | `routers/ai_providers.py:14,87,99,161` | **Fixed at the API boundary** (`_public_base`, auth mode only) |
| 5 | Medium | API Studio `/stream` relay used a plain `httpx.Client` (host checked once up front only). | `routers/studio.py:133` | **Fixed** (uses `netguard.safe_client`, re-checks per request incl. redirects) |
| 6 | Medium | Personal access tokens (`dtr_…`, meant for the user's AI client) inherited backoffice admin rights when created by an admin. | `core/admin.py:32` | **Fixed** (`require_admin` refuses `token_id` users) |
| 7 | Low | SQL function deny-list lacked extension/network/session helpers (`load_*`, `install_*`, `http_*`, `set_variable`, `getvariable`, `which_secret`, `export_*`, `checkpoint`). Not exploitable today (no such functions loaded / httpfs not installed) — defence in depth. | `core/security.py:51` | **Fixed** |
| 8 | Medium | DNS rebinding: `ensure_public_host` resolves, then httpx resolves again at connect time (TOCTOU). A short-TTL attacker domain can flip to a private IP between the two. | `core/netguard.py:39-63` | **Open** — needs a transport that connects to the pre-resolved IP (pin + SNI/Host header), or egress firewalling of the server (recommended: block RFC1918/metadata at the host/VPC level). |
| 9 | Medium | Stored AI providers created **before** fix #4, and the built-in `OPENAI_COMPATIBLE_DEFAULTS` (e.g. Ollama on localhost) are called with plain `httpx.post`, unchecked at call time. | `services/ai.py:74,103,133`, `services/ai_models.py:56` | **Open** (owned by the AI agent): call `netguard.ensure_public_url(base_url)` (or use `safe_client`) before every outbound AI request when auth is on. |
| 10 | Low | Admin = email in `ADMIN_EMAILS` (`core/admin.py:25-28`) without requiring `email_verified`. Safe while the admin has registered that address (Supabase rejects duplicates); risky if an admin address is listed but never registered and autoconfirm is on. | `core/admin.py:28` | **Open** — recommend requiring `email_verified` or matching admin by user id. |
| 11 | Low | No global per-user API rate limit; throttles exist only for auth, shares, verification codes and access tokens (`services/throttle.py`, `access_tokens.allow`). AI calls are budgeted by `ai_limits`. Heavy SQL is bounded by DuckDB memory/threads and LIMIT injection. | `backend/Main.py` | **Open** — add a lightweight per-user token bucket middleware or rate-limit at the reverse proxy (Cloudflare). |
| 12 | Low | `MaintenanceMiddleware` reads the email from the **unverified** token to let admins through maintenance. Route auth still applies, so a forged token only skips the 503 screen. | `services/admin/controls.py:124` | Accepted (documented in code) |
| 13 | Low | Child tables without `workspace_id` (`alert_runs`, `columns_meta`, `dataset_tests`) are deleted by parent id via raw `store.execute`; each call site checks the parent with the scoped `store.get` first. | `routers/alerts.py:79-81`, `routers/datasets.py:232-242` | OK (keep the parent-check pattern for any new raw delete) |
| 14 | Low | Local mode (`AUTH_ENABLED=false`) intentionally disables SQL table-only restriction, SSRF and path confinement. Never expose a local-mode server publicly. | `core/security.py:87`, `core/netguard.py` | By design |

## Tests run (all with `backend\.venv\Scripts\python.exe`, `DISK_USAGE_LIMIT_PCT=0`)
`test_security`, `test_tenant`, `test_auth_hardening`, `test_admin`, `test_shares`, `test_redact`, `test_secrets`,
`test_remote`, `test_studio`, new `test_isolation_security` — **all pass**.
Note: without `DISK_USAGE_LIMIT_PCT=0` the upload-based tests fail on this machine because the disk is 89% full
(`services/disk.py:25`) — environmental, not a security regression.
