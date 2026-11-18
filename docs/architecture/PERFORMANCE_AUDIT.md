# Query engine / data infrastructure performance audit (2026-11-18)

Scope: `services/engine.py`, `core/store.py` (connections), `core/duck.py`, `services/columnar.py`, `services/ingest.py`,
`services/refresh*.py`. Benchmark: `Scripts/bench_engine.py` (synthetic zstd Parquet datasets behind views, queried
through `QueryEngine.execute(fresh=True)`, median of 5; temp folder deleted afterwards; ~70 MB peak on disk).

## Findings

| Area | State | Verdict |
|---|---|---|
| Connection lifecycle | One long-lived DuckDB instance per workspace, a cursor per query (`_session`); metadata `Store` same, behind one lock | OK. The "each metadata write opens a connection ~50 ms" item is already fixed (long-lived instance); measured 6-16 ms per insert (WAL commit), 1.6-3 ms per list. Audit writes stay async (D9). |
| Concurrency | Readers run concurrently on cursors (MVCC); writers serialised by `_write_lock` + `_linked_lock`; one process per file (`duck.connect` waits on the lock up to 120 s) | OK. 8 threads ~2-2.6x faster than 1 for 16 group-bys (3 DuckDB threads cap the gain, by design §55). |
| Timeout / cancellation | `threading.Timer` -> `cursor.interrupt()`, raises `QueryTimeout`; covers execute + fetch | OK (test_engine). |
| **Row cap** | `validate_readonly` injects LIMIT only when absent; the engine did `fetchall()` | **BUG**: `SELECT * ... LIMIT 1000000` materialised 1M dicts (25 s, unbounded RAM). Fixed: `fetchmany(limit+1)`, `truncated:` warning, cap is part of the cache/single-flight key. |
| memory_limit / threads / temp_dir | Set at connect (`6GB`, 3 threads, `data/tmp`), `preserve_insertion_order=false` | OK; DuckDB removes its spill files on close. |
| Failed ingestion atomicity | Staging table -> COPY to `<ds>.parquet.tmp` -> quota check -> `os.replace`; staging dropped in `finally` | Atomic for in-process errors. **BUG** after a process kill (OOM/redeploy) mid-COPY: `*.parquet.tmp` stayed in the parquet dir and counted against the user's quota forever, plus an orphan `*__stg` table. Fixed: `columnar.sweep_orphans` on first open of a workspace instance. |
| Parquet scan | Views over `read_parquet` (projection/filter pushdown), zstd | OK: 5M-row group-by 270 ms, `SELECT *` capped at 10k reads ~50 ms regardless of size. |
| DataFrame materialisation | Engine returns dicts (needed for JSON); derived refresh goes Polars -> Arrow -> table | Acceptable; result rows bounded by the cap now. |

## Benchmark (same machine, before = original code, after = fixes). Machine was shared with other agents, so
absolute latencies vary ±2x between runs; only the LIMIT row is a code effect.

| rows | case | before ms | after ms |
|---|---|---|---|
| 10k | agg / group-by / join | 10 / 14 / 12 | 6 / 8 / 7 |
| 1M | agg / group-by / join | 88 / 349 / 242 | 55 / 58 / 33 |
| 5M | agg / group-by / join | 473 / 572 / 267 | 269 / 268 / 148 |
| 5M | 16 group-bys, 1 thread / 8 threads | 11,169 / 6,106 | 4,010 / 1,933 |
| 1M | `SELECT * LIMIT 1000000` | **25,243 (1,000,000 rows)** | **64 (10,000 rows, truncated)** |
| 5M | `SELECT * LIMIT 1000000` | **22,056** | **81** |
| - | peak RSS after 5M suite | not measured (script bug) | 149 MB |
| - | metadata insert / list per op | 16.2 / 3.2 | 5.8 / 1.6 (no code change) |

## Open items
- Single-flight followers wait `query_timeout_s + 5` and then run the query themselves; fine today.
- Metadata writes still fsync per statement; batch if a hot path ever writes many rows synchronously.
- Store serialises reads behind one lock (cheap at 1-3 ms); revisit only if metadata reads show up in latency.
