# ai-memory — index, routing and update rules

Purpose: give any AI the full project picture in the fewest tokens. Entry point is `../AI.md`.

## Files (read order = tier)
| Tier | File | Contains | Budget | Read when |
|---|---|---|---|---|
| L1 | `00-overview.md` | what/why, stack, how to run, conventions | ≤80 lines | always |
| L1 | `02-status.md` | done / in progress / next / known bugs (the "hot" file) | ≤80 lines | always |
| L2 | `01-architecture.md` | file map, data flow, DB tables, API routes, UI pages | ≤200 lines | touching code |
| L2 | `03-decisions.md` | why things are the way they are (ADR-lite) | ≤100 lines | before changing design |
| L2 | `04-gotchas.md` | traps, env quirks, past bugs + fixes | ≤80 lines | errors / setup |
| L3 | `05-changelog.md` | one line per change, newest at the BOTTOM | append-only | read last ~15 lines only |
| L3 | `07-chat2db-research.md` | feature matrix vs Chat2DB & alternatives (have / gap / plan) | edit statuses in place | read when planning features |
| L3 | `sessions/*.md` | detailed notes for big sessions | ≤60 lines each | resuming that work |

## Task → what to read
- Add/modify an API endpoint → 01 (routes + file map), then the one router file.
- Add a DB column/table → 01 (tables) + `core/store.py` `MIGRATIONS` list; update 01 after.
- UI change → 01 (pages/components), then the one page file.
- AI/provider/prompt work → 01 (AI section) + 03.
- Bug → 04 first (may already be known), then 02 known-bugs.
- "Continue previous work" → 02, then `tail -n 15 05-changelog.md`, then newest `sessions/` file.

## Update rules (every AI, after every task that changed something)
1. **Changelog line (always):** `YYYY-MM-DD · <ai/tool> · <files> · <what + why in ≤25 words>`.
2. **Edit in place.** Update the one fact that changed in the right file. No duplicates, no
   "previously X, now Y" — just state Y. Delete obsolete facts.
3. **02-status.md:** move items between Done / In progress / Next; add/remove known bugs. Keep "Last updated".
4. **01-architecture.md:** touch only when a file, route, table, page, env var or dependency is
   added/renamed/removed. Keep one line per item: `path — purpose`.
5. **03-decisions.md:** add an entry only for choices a future AI could wrongly undo
   (format: `D<n> · date · decision · why · alternatives rejected`).
6. **04-gotchas.md:** add only things that cost real time (symptom → cause → fix).
7. **sessions/:** only for multi-file or multi-step work. Copy `sessions/_TEMPLATE.md`.
8. **Size control:** if a file exceeds its budget, compress it (merge, shorten, drop stale items)
   instead of appending. When `05-changelog.md` passes ~150 lines, fold the oldest 100 into
   `sessions/archive-<year>.md` as a 10-line summary.
9. **Verify before writing:** record only what you saw in code/output this session. Mark guesses `(unverified)`.
10. **No secrets, no pasted code blocks >10 lines, no logs.** Point to `path:line` instead.

## Token-saving design (why it's built this way)
- Tiered loading: ~2 small files always, everything else on demand.
- Hot/cold split: volatile state lives only in `02-status.md`; stable facts in `00`/`01`.
- File map with purposes + sizes lets the AI jump to the right file without opening others.
- "Never read" list in `AI.md` blocks the biggest token sinks (venv, node_modules, DB, logs, spec).
- Append-only changelog is read from the tail; sessions are only opened when resuming that work.
- Hard line budgets + compress-not-append rule stop memory from growing into the problem it solves.
- Facts verified against code; the memory references paths (cheap to re-check) instead of pasting code.
