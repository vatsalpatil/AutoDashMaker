# AutoDashMaker

AI-native data analytics platform — rebuilt from SmartDashBoardMaker with a connected
Source → Dataset → Query → Chart → Dashboard architecture, data-quality scoring,
lineage, and a pluggable AI provider layer (Gemini free tier as default).

**Stack:** FastAPI · DuckDB (analytics + metadata) · Polars · sqlglot · Vite + React + TypeScript · Astryx (Meta design system) + shadcn-style components · Tailwind · Recharts

## Run

```bash
# Backend (port 8001)
cd backend
.venv/Scripts/python.exe -m uvicorn main:app --port 8001

# Frontend (port 5174)
cd frontend
npm run dev
```

Open http://localhost:5174 — API docs at http://127.0.0.1:8001/docs

## Architecture

```
backend/
  main.py                  FastAPI entrypoint
  app/
    core/      config.py · store.py (DuckDB metadata store) · security.py (read-only SQL guard)
    connectors/ base · files (CSV/Excel/Parquet/JSON) · postgres · rest
    services/  engine.py (query exec + result profiling) · quality.py · lineage.py · ai.py (provider registry)
    routers/   datasources · datasets · queries · charts · dashboards · quality · ai
  data/        analytics.duckdb (ingested tables) · metadata.duckdb (platform entities)
  uploads/     uploaded files
frontend/
  src/pages    Ask · Sources · Datasets · Workbench · Charts · Dashboards · Quality · Settings
```

## Features

- **Ask** — natural-language question → safe read-only SQL → result + provenance strip
- **Sources** — PostgreSQL / REST API / file connectors with connection testing
- **Datasets** — upload & ingest, live schema profiling (nulls, distinct, samples)
- **Workbench** — SQL editor; every query passes a sqlglot read-only validator with auto LIMIT
- **Charts** — declarative specs backed by saved queries, always re-executed fresh
- **Dashboards** — 12-column grid widgets + full lineage view (dashboard → chart → query → dataset → source)
- **Quality** — completeness / uniqueness / validity / duplicate % / freshness scoring
- **Settings** — connect any AI provider (Gemini free default, OpenAI, Anthropic, Groq, OpenRouter, Ollama)

Auth is intentionally deferred; the metadata schema already carries
organization_id / workspace_id / created_by for a clean multi-tenant upgrade.
