"""Analytical query engine: DuckDB execution + result profiling + lineage."""
from __future__ import annotations

import re
import threading
import time
from collections import OrderedDict
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

import duckdb

from ..core import duck, tenant
from ..core.config import settings
from ..core.security import UnsafeQueryError, quote_ident, validate_readonly


# SQL whose result depends on the clock/randomness must never be served from cache
SAMPLE_HEAD = 2000   # rows read once to pick the sample values shown per column

_NONDETERMINISTIC = re.compile(
    r"\b(now|current_date|current_time|current_timestamp|localtimestamp|today|random|uuid|gen_random_uuid)\b",
    re.IGNORECASE)


class QueryTimeout(Exception):
    pass


class QueryEngine:
    def __init__(self, path: str):
        self._path = path
        self._base: duckdb.DuckDBPyConnection | None = None
        self._base_lock = threading.Lock()
        self._linked_lock = threading.RLock()   # sessions that attach a remote source (and writers) run one at a time
        self._write_lock = threading.RLock()
        self._flight_lock = threading.Lock()
        self._inflight: dict[str, tuple[threading.Event, dict]] = {}
        # result cache: sql -> (expires_at, result). invalidate() clears it and bumps
        # _version so a query that was already running can't re-insert stale rows.
        self._cache: OrderedDict[str, tuple[float, dict[str, Any]]] = OrderedDict()
        self._cache_lock = threading.Lock()
        self._cache_rows = 0
        self._version = 0

    # -- connections ------------------------------------------------------
    # One long-lived DuckDB instance per workspace; every piece of work gets its own cursor. Cursors run concurrently
    # (DuckDB is MVCC: many readers plus a writer), and the instance keeps its buffer cache and Parquet metadata warm
    # between queries, which a fresh `connect()` per query threw away. SQL is still validated read-only before it gets here.
    def _config(self) -> dict[str, Any]:
        # Bound memory/CPU so analytics can't starve the rest of the server (§55).
        return {
            "memory_limit": settings.duckdb_memory_limit,
            "threads": int(settings.duckdb_threads),
            "preserve_insertion_order": False,
            "temp_directory": settings.duckdb_temp_dir.replace("\\", "/"),
        }

    def _shared(self) -> duckdb.DuckDBPyConnection:
        with self._base_lock:
            if self._base is None:
                self._base = duck.connect(self._path, config=self._config())
            return self._base

    def close(self) -> None:
        """Release the file (account deletion, shutdown). The next use reopens it."""
        with self._base_lock:
            if self._base is not None:
                try:
                    self._base.close()
                except Exception:
                    pass
                self._base = None

    @staticmethod
    def _detach_remotes(con: duckdb.DuckDBPyConnection) -> None:
        """Remote sources (MySQL/Postgres/SQLite) are attached to the shared instance only while a piece of work needs them."""
        try:
            names = [r[0] for r in con.execute("SELECT database_name FROM duckdb_databases() WHERE NOT internal AND type <> 'duckdb'").fetchall()]
            for n in names:
                con.execute(f'DETACH DATABASE IF EXISTS "{n}"')
        except Exception:
            pass  # nothing attached, or already gone

    @contextmanager
    def _session(self, hint: str | None = None) -> Iterator[duckdb.DuckDBPyConnection]:
        """A connection for one piece of work. SQL that names a linked (live) dataset attaches its remote source for the
        duration (those sessions are serialised and detach afterwards); everything else runs concurrently on its own cursor."""
        from . import remote
        if hint and remote.mentions_linked(hint):
            with self._linked_lock:
                con = self._shared().cursor()
                try:
                    remote.attach_remotes(con, hint)
                    yield con
                finally:
                    self._detach_remotes(con)
                    con.close()
            return
        con = self._shared().cursor()
        try:
            yield con
        finally:
            con.close()

    def connect(self, read_only: bool = False, hint: str | None = None):
        """Context manager yielding a connection. Use `writer()` for anything that changes data (`read_only` is kept for callers; reads are
        guarded by validate_readonly)."""
        return self._session(hint)

    @contextmanager
    def writer(self) -> Iterator[duckdb.DuckDBPyConnection]:
        """Writable connection (one writer at a time); cached results are dropped AFTER the write, so a read that
        raced the write can't leave stale rows in the cache."""
        with self._write_lock, self._linked_lock:
            con = self._shared().cursor()
            try:
                yield con
            finally:
                self._detach_remotes(con)   # the writer may have attached a source to read from
                con.close()
                self.invalidate()

    # -- result cache (§53) ----------------------------------------------
    def invalidate(self) -> None:
        with self._cache_lock:
            self._version += 1
            self._cache.clear()
            self._cache_rows = 0

    def _cache_get(self, key: str) -> dict[str, Any] | None:
        with self._cache_lock:
            hit = self._cache.get(key)
            if not hit:
                return None
            if hit[0] < time.monotonic():
                del self._cache[key]
                self._cache_rows -= hit[1]["row_count"]
                return None
            self._cache.move_to_end(key)
            return hit[1]

    def _cache_put(self, key: str, version: int, result: dict[str, Any]) -> None:
        if result["row_count"] > settings.result_cache_max_rows or _NONDETERMINISTIC.search(key):
            return
        with self._cache_lock:
            if version != self._version:  # data changed while the query ran
                return
            old = self._cache.pop(key, None)
            if old:
                self._cache_rows -= old[1]["row_count"]
            self._cache[key] = (time.monotonic() + settings.result_cache_ttl_s, result)
            self._cache_rows += result["row_count"]
            # bounded by entries AND by total rows held, so a few big results cannot eat the memory
            while self._cache and (len(self._cache) > settings.result_cache_entries or self._cache_rows > settings.result_cache_total_rows):
                _, (_, dropped) = self._cache.popitem(last=False)
                self._cache_rows -= dropped["row_count"]

    # -- execution --------------------------------------------------------
    def execute(self, sql: str, row_limit: int | None = None, fresh: bool = False, params: dict[str, Any] | None = None) -> dict[str, Any]:
        """`fresh=True` skips the result cache (the user pressed Refresh); the new result still refreshes the cache.
        `params` fill `{{name|default}}` placeholders (services/sql_params) before validation."""
        limit = row_limit or settings.default_row_limit
        from . import names, sql_params
        safe_sql = validate_readonly(names.resolve(sql_params.render(sql, params)), limit)
        cached = None if fresh else self._cache_get(safe_sql)
        if cached is not None:
            return {**cached, "cached": True, "duration_ms": 0.0}
        # single flight: the same query asked by several widgets at once runs once, the others take its result
        with self._flight_lock:
            flight = self._inflight.get(safe_sql)
            leader = flight is None
            if leader:
                flight = self._inflight[safe_sql] = (threading.Event(), {})
        event, holder = flight
        if not leader:
            event.wait(timeout=settings.query_timeout_s + 5)
            if "result" in holder:
                return {**holder["result"], "cached": True, "duration_ms": 0.0}
            if "error" in holder:
                raise holder["error"]
        try:
            result = self._run(safe_sql)
            if leader:
                holder["result"] = result
            return result
        except Exception as e:
            if leader:
                holder["error"] = e
            raise
        finally:
            if leader:
                with self._flight_lock:
                    self._inflight.pop(safe_sql, None)
                event.set()

    def _run(self, safe_sql: str) -> dict[str, Any]:
        version = self._version  # plain int read; compared again under the lock in _cache_put
        t0 = time.perf_counter()
        from . import remote
        run_sql = remote.rewrite_sql(safe_sql)  # linked datasets read their remote table directly
        with self._session(hint=safe_sql) as con:
            # Enforce the query timeout: interrupt() makes execute raise InterruptException (this cursor only).
            timer = threading.Timer(settings.query_timeout_s, con.interrupt)
            timer.start()
            try:
                rel = con.execute(run_sql)
                cols = [d[0] for d in rel.description]
                rows = rel.fetchall()
            except duckdb.InterruptException as e:
                raise QueryTimeout(f"query exceeded {settings.query_timeout_s}s and was cancelled") from e
            finally:
                timer.cancel()
        duration = (time.perf_counter() - t0) * 1000
        records = [dict(zip(cols, r)) for r in rows]
        result = {
            "sql": safe_sql,
            "columns": cols,
            "rows": tuple(records),  # shared with the cache: immutable on purpose
            "row_count": len(records),
            "duration_ms": round(duration, 1),
            "warnings": tuple(self._profile_result(records, cols)),
            "cached": False,
        }
        self._cache_put(safe_sql, version, dict(result))  # private copy: callers may mutate theirs
        return result

    # -- result validation (§20 of the blueprint) -------------------------
    @staticmethod
    def _profile_result(rows: list[dict], cols: list[str]) -> list[str]:
        """Cheap sanity warnings. Column-wise and early-exit: on a 10,000-row result this used to build a set of sorted tuples
        for every row, which cost more than the query."""
        n = len(rows)
        if n == 0:
            return ["empty_result: query returned zero rows"]
        warnings = []
        if n >= 20:
            for c in cols:
                nulls = sum(1 for r in rows if r.get(c) is None)
                if nulls / n > 0.5:
                    warnings.append(f"null_explosion: column '{c}' is {nulls/n:.0%} null")
        if n > 1:
            try:
                first = rows[0]
                if all(r == first for r in rows[1:]):   # stops at the first row that differs
                    warnings.append("duplicate_rows: every row is identical")
            except Exception:
                pass
        return warnings

    # -- schema discovery --------------------------------------------------
    def describe_table(self, table: str) -> dict[str, Any]:
        from . import remote
        if remote.is_linked(table):
            return self._describe_linked(table)
        ref = table
        with self._session(hint=table) as con:
            info = con.execute(f"PRAGMA table_info('{table}')").fetchall()
            names = [r[1] for r in info]
            # one table scan for every column's null/distinct stats (was 2 scans per column)
            aggs = ", ".join(f"COUNT(*) - COUNT({quote_ident(n)}), COUNT(DISTINCT {quote_ident(n)})" for n in names)
            row = con.execute(f"SELECT COUNT(*), {aggs} FROM {ref}").fetchone() if names else (0,)
            count = row[0]
            # samples: one pass over the first rows instead of a DISTINCT query per column; a column that is
            # sparse up there (fewer than 5 values found although more exist) falls back to the exact query
            head = con.execute(f"SELECT * FROM {ref} LIMIT {SAMPLE_HEAD}").fetchall() if names else []
            columns = []
            for i, r in enumerate(info):
                name, dtype = r[1], r[2]
                nulls, distincts = row[1 + 2 * i], row[2 + 2 * i]
                samples = list(dict.fromkeys(v[i] for v in head if v[i] is not None))[:5]
                if len(samples) < min(5, distincts):
                    samples = [x[0] for x in con.execute(
                        f"SELECT DISTINCT {quote_ident(name)} FROM {ref} WHERE {quote_ident(name)} IS NOT NULL LIMIT 5"
                    ).fetchall()]
                columns.append({
                    "name": name, "dtype": dtype,
                    "null_pct": round(nulls / count * 100, 2) if count else 0,
                    "distinct_count": distincts,
                    "sample_values": [str(x)[:60] for x in samples],
                })
        return {"table": table, "row_count": count, "columns": columns}

    def _describe_linked(self, table: str) -> dict[str, Any]:
        """Schema of a linked (live) dataset: stored row count + stats from a 100-row sample.

        Profiling a whole remote table (distinct counts over millions of rows) would hammer the source."""
        from . import remote
        from ..core.store import store
        ref = remote.table_ref(table)
        with self._session(hint=table) as con:
            rel = con.execute(f"SELECT * FROM {ref} LIMIT 100")
            names = [d[0] for d in rel.description]
            types = [str(d[1]) for d in rel.description]
            rows = rel.fetchall()
        meta = store.list("datasets", where="physical_name = ?", params=[table], order=None)
        total = int(meta[0].get("row_count") or len(rows)) if meta else len(rows)
        exact = self._remote_stats(meta[0], names) if meta else None
        columns = []
        for i, name in enumerate(names):
            vals = [r[i] for r in rows]
            present = [v for v in vals if v is not None]
            nulls, distinct = exact[name] if exact else (None, None)
            columns.append({
                "name": name, "dtype": types[i],
                "null_pct": round(nulls / total * 100, 2) if exact and total else round((len(vals) - len(present)) / len(vals) * 100, 2) if vals else 0,
                "distinct_count": distinct if exact else len({str(v) for v in present}),
                "sample_values": list(dict.fromkeys(str(v)[:60] for v in present))[:5],
            })
        return {"table": table, "row_count": total, "columns": columns, "sampled": not exact}

    def _remote_stats(self, ds: dict[str, Any], names: list[str]) -> dict[str, tuple[int, int]] | None:
        """Exact null/distinct counts computed inside the source database (one aggregate query, one row back)."""
        from ..connectors import get_connector
        from ..core.store import store
        from . import remote
        src = store.get("datasources", ds["source_id"]) if ds.get("source_id") else None
        if not src or not ds.get("remote_table"):
            return None
        try:
            with self._session(hint=ds["physical_name"]) as con:
                return get_connector(src["type"], src["config"]).remote_profile(con, remote.alias_for(src["id"]), ds["remote_table"], names)
        except Exception:
            return None  # the sample-based profile is the fallback

    def check_sql(self, sql: str) -> str | None:
        """Bind-check a query against the real schema without running it (DuckDB EXPLAIN).

        Returns the database's error text (unknown table/column, type errors...) or None if it binds.
        Unsafe SQL is left for validate_readonly to reject, so it also returns None here.
        """
        from . import names
        try:
            safe = validate_readonly(names.resolve(sql), settings.default_row_limit)
        except UnsafeQueryError:
            return None
        with self._session(hint=safe) as con:
            try:
                from . import remote
                con.execute(f"EXPLAIN {remote.rewrite_sql(safe)}")
            except duckdb.Error as e:
                return str(e)[:400]
        return None

    def list_tables(self) -> list[str]:
        with self._session() as con:
            return [r[0] for r in con.execute("SHOW TABLES").fetchall()]

    def drop_table(self, table: str) -> None:
        with self.writer() as con:
            try:
                con.execute(f"DROP TABLE IF EXISTS {table}")
            except duckdb.CatalogException:  # linked (live) datasets are views
                con.execute(f"DROP VIEW IF EXISTS {table}")


class _WorkspaceEngines:
    """`engine` as the rest of the app uses it, routed to the current workspace's own DuckDB file.

    A user's SQL can therefore only ever see their own tables. System code (schedulers) must enter a
    workspace first with tenant.run_as(); asking for an engine under all_workspaces() is a bug and fails loudly.
    """

    def __init__(self) -> None:
        self._engines: dict[str, QueryEngine] = {}
        self._lock = threading.Lock()

    def for_workspace(self, ws: str) -> QueryEngine:
        if ws == tenant.ALL:
            raise RuntimeError("engine used outside a workspace: wrap the call in tenant.run_as(workspace_id, ...)")
        with self._lock:
            if ws not in self._engines:
                path = tenant.analytics_path(ws)
                if not Path(path).exists():  # first use by a new user: create their empty analytics file
                    duckdb.connect(path).close()
                self._engines[ws] = QueryEngine(path)
            return self._engines[ws]

    def close_workspace(self, ws: str) -> None:
        """Close and forget a workspace's engine (its file is about to be deleted)."""
        with self._lock:
            eng = self._engines.pop(ws, None)
        if eng:
            eng.close()

    def __getattr__(self, name: str) -> Any:
        return getattr(self.for_workspace(tenant.current()), name)


engine = _WorkspaceEngines()
