# Session: 2026-11-24 — demo fixes + multi-project test campaign on live
Tool/AI: claude (Claude Code desktop)

## Goal
Full lifecycle demo, fix what it showed, then test the system like a QA engineer with 10 multi-file projects
(big notebooks, big dashboards, monitor features, every tab), fix, push, repeat. Plus a developer-experience plan.

## What happened
- Generated 10 projects in-browser (seeded; dirty on purpose: blanks, duplicates, quotes/commas, unicode, mixed date
  formats, negative stock, -999 sensors, case variants, JSON file, files up to 200k rows). Only HR, Ecommerce web,
  Inventory (+1 finance file) uploaded: the account hit the 20-dataset limit (admin per-user limit; raising it is the
  owner's call — not done by the AI).
- 7 pushes (e05ffe6 … b0a817d), verify green each time (63/63). See 05-changelog for each.

## Bugs found → fixed
- SQL guard parsed with the generic dialect: list indexes shifted, regexp_extract lost args (silent wrong results).
- PIVOT statements rejected; dataset names not resolved inside PIVOT; ANSI codes in errors.
- Relationship suggestions: 96 noisy pairs → key-like + overlapping values only (13 real + 0 noise after fixes).
- Quality validity was a placeholder (always 100) → real rules with row counts and examples.
- Alerts: bad column → 500; NULL/rows/text unclear; wrong-case text → false alarms. Reports silently cut at 100k.
- Combine needed hand-saved relationships → uses obvious keys; lookup numbers flagged "never SUM".
- Generator: flat 20-chip picker → folders; ugly names (timestamp, "Hr"); suggestions on single-value columns;
  ignored defined key numbers.

## Verified on live
- 18-cell notebook (recursive CTE, QUALIFY, PIVOT, ASOF, quantiles, funnel, cohorts) 3-22 ms per cell.
- HR 4-table AI dashboard: 40 widgets / 8 pages, KPI = hand SQL (Sep hours 29,573).

## Open
- Remaining 7 projects need the dataset limit raised (Admin → Users → limits).
- Developer-experience plan: Plan/developer-experience.md (not started).
- Score: generator made 18 KPIs on one dashboard (review gives 86/100) — consider capping KPIs per page.
