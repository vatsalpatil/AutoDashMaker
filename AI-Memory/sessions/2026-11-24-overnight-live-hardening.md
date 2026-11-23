# Session: 2026-11-23/24 — notebook features, local AI, AI memory, overnight live hardening
Tool/AI: claude (Claude Code desktop)

## Goal
Notebook Markdown cells + Tab autocomplete; local open-source AI; user AI memory (Markdown files); then an
autonomous overnight loop on the LIVE site: test → fix → verify → push → wait for deploy → re-test the whole lifecycle.

## What changed (see 05-changelog for every commit)
- Notebook: Markdown cells, gutter (#n / run / status), ghost-text autocomplete (history + rules + AI, Tab).
- AI: Local AI provider (Ollama, Qwen2.5-Coder) + cascade; memory files injected into every ai.chat; `remember …`.
- Accuracy: exact text values in prompts (`column_values`), case fix for every AI SQL + Query Builder (`value_guard`),
  dropped-filter retry in Ask, relationships with cardinality in prompts, full column stats on import + back-fill
  (`column_stats` — ROOT CAUSE: connectors stored only name+type), latest-period KPI titles (`dash_gen.period_title`).
- Multi-table: `/transforms/blend-many` (many-to-one joins only, skipped tables reported), generator Data picker.
- Robustness: thinking-model empty replies retry with 4x tokens; OpenRouter `:free` fallback list (also streaming);
  DuckDB result API independent (`transforms.frame`, CREATE TABLE AS); `tenant.bind` copies context per call.
- UX: plain 502/401/413/429 + SQL error messages, no internal ds_ names/paths; phone layout; button contrast;
  Quality "Check all"; smarter starter chips / key-number suggestions; dataset delete cleans relationships + upload.

## Decisions / trade-offs
- Live account uses OpenRouter `google/gemma-4-26b-a4b-it:free` (1.5 s SQL; benchmarked vs gemma-31b 49 s,
  nemotron-ultra 19 s). Free tier ≈ 50 requests/day per account → keep AI tests rationed.
- Don't pin DuckDB lower: older versions can't open files written by newer ones.

## Open items / next steps
- Combined datasets are snapshots (re-run combine after new uploads); each generator run makes a new combined_* set.
- `delete_source` doesn't remove an uploaded file from disk (dataset delete does).
- Ask latency with free models is 5-45 s depending on rate-limit fallbacks.
- Demo data left on the live account on purpose: 5 sales tables + sales_combined, relationships, "Net revenue" key
  number, an alert, a weekly report, 2 dashboards, 3 data tests.

## Verified how
- `Scripts/verify.py` green before every push (60/60 at the end); each fix re-tested on dashtor.laveyent.com after deploy.
