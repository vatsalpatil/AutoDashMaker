# 00 — Overview (stable facts)

**AutoDashMaker** (user-facing brand: **Dashtor**, set in `frontend/src/lib/brand.ts`): AI-native data analytics platform (rebuilt from "SmartDashBoardMaker").
Pipeline: **Source → Dataset → Query → Chart → Dashboard**, with data-quality scoring, lineage,
a semantic layer (metrics/definitions), natural-language "Ask", alerts, and a pluggable AI provider layer
(Gemini free tier default). Local mode = single user, no login (`ws_default`); hosted = Supabase login + one isolated workspace per user (D23) (schema already has
`organization_id`/`workspace_id`/`created_by` for later multi-tenancy).

Spec: `Plan/smart-data-platform-requirements.md` (huge; `§N` refs). Feature checklist vs spec: `PROGRESS.md`.

## Stack
- Backend: Python, FastAPI, DuckDB (analytics DB + metadata DB), Polars, sqlglot (SQL guard), httpx, pydantic-settings.
- Frontend: Vite + React 19 + TypeScript, react-router v6, **Tailwind v4**, **shadcn/ui (Base UI flavour, preset `base-nova`) + ReUI registry** (`@reui`), Recharts, react-grid-layout, lucide-react. (Astryx was removed 2026-10-02.)
- AI providers: Gemini (default), OpenAI, Anthropic, Groq, OpenRouter, Ollama — keys stored in DB table `ai_providers`, set via Settings page.

## Run (Windows)
```
# backend (port 8001 via uvicorn; or `python backend/main.py` = port 8000, the proxy default)
cd backend
.venv\Scripts\python.exe -m uvicorn main:app --port 8001
# frontend (port 5174; proxies /api -> 127.0.0.1:8000, override: API_TARGET=http://127.0.0.1:8001 npm run dev)
cd frontend
npm run dev
```
Local screen on the LIVE server's data (sign in with your account): `cd frontend && npm run dev:online` (API_TARGET in `frontend/.env.online`).
API docs: http://127.0.0.1:8000/docs (or your uvicorn port)/docs · UI: http://localhost:5174
`python backend/main.py` uses port 8000 (reload=True) = the proxy default; uvicorn examples use 8001, so set `API_TARGET` when using them.

## Conventions
- Backend layering: `routers/` (HTTP, thin) → `services/` (logic) → `core/store.py` (metadata CRUD) / `services/engine.py` (analytics queries) ; `connectors/` for ingestion.
- Metadata access via the generic `store` object: `insert/list/get/update/delete/execute`. Rows are dicts; JSON fields stored as TEXT.
- Schema changes: add to `SCHEMA` for new tables; for new columns append an idempotent `ALTER TABLE` to `MIGRATIONS` in `core/store.py`.
- Frontend API access only through `frontend/src/lib/api.ts` (`api.get/post/put/patch/del/upload`, base `/api`); shared types in `lib/types.ts`.
- AI output that contains SQL is always validated (`validate_readonly`) and never auto-executed by the SQL-assistant endpoint.
- Explanations/confidence/"why" are deterministic (rule-based), not LLM-generated — keeps answers auditable.

## Code structure & reuse rules (standing instruction from the user — follow them)
Goal: **do more with less code.** Reuse before writing; keep files small and focused.
1. **Reuse first.** Before writing UI or logic, look in `hooks/`, `components/common/`, `components/ui/` (shadcn), `components/reui/`, `features/*`, `lib/`. Compose or extend what exists. When a pattern would appear a second time, extract it instead of copying.
2. **Frontend layout (`frontend/src`):** `hooks/` reusable hooks (`useApi` GET + loading/error, `useAsyncAction` mutations + busy/error, `useLocalStorage`, `useResizableWidth` in common/ResizeHandle) · `components/ui/` shadcn primitives (GENERATED, don't hand-edit; add with `npx shadcn@latest add <name>`) · `components/reui/` ReUI primitives (GENERATED: `npx shadcn@latest add @reui/<name>`) · `components/ui/kit.tsx` label/variant wrappers (Button, Badge, Card, TextInput, Dialog…) over those · `components/common/` app-wide pieces (DataGrid, ResizeHandle, AsyncView, PageHeader, ErrorBanner, Loading…) · `features/<name>/` feature code (workbench, ai, settings) · `pages/` THIN route components that only compose features · `lib/` api client, theme, types, utils.
3. **Size budget:** hand-written files ≤ 250 lines (hard limit 400); pages ≤ ~100. Run `python scripts/check_file_sizes.py` (add `--strict` to fail). Generated `components/ui` + `components/reui` are exempt.
4. **Split by responsibility:** state/logic → `use*.ts` hook or `*Model.ts` (pure helpers); visuals → small components; fetching → `useApi`/`AsyncView`; mutations → `useAsyncAction`; persistence → `useLocalStorage`. Don't split by arbitrary line count.
5. **Backend the same:** routers = thin HTTP only → `services/` = logic (one concern per module: compose, dialects, assist, audit, attention…) → `core/`. Shared helpers go in `services/`, never copied between routers.
6. **Theming:** colours only via shadcn tokens (`bg-card`, `text-muted-foreground`, `border`…), never hard-coded `slate-*`/`white` — presets in `lib/theme.ts` drive the tokens in `index.css`.

## Repo top level
`AI.md` (entry) · `ai-memory/` (this memory) · `PROGRESS.md` (feature checklist vs spec) · `README.md` (human intro) ·
`backend/` · `frontend/` · `Plan/` (spec + unrelated exes) · `.vscode/`
