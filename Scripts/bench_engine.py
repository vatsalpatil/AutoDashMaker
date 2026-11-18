"""Query-engine benchmark: synthetic Parquet datasets (10k / 1M / 5M rows) queried through QueryEngine.

Measures aggregation / group-by / join latency (median of N, cache bypassed), peak RSS, concurrent throughput
with threads, big-result materialisation and metadata-store write latency. Everything lives in a temp folder that
is deleted at the end (5M rows ~ 60 MB of Parquet).

    backend\\.venv\\Scripts\\python.exe Scripts/bench_engine.py [--sizes 10000,1000000,5000000] [--runs 5]
"""
from __future__ import annotations

import argparse
import ctypes
import os
import shutil
import statistics
import sys
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor

TMP = tempfile.mkdtemp(prefix="dashtor_bench_")
os.environ.update(METADATA_DB=os.path.join(TMP, "meta.duckdb"), ANALYTICS_DB=os.path.join(TMP, "a.duckdb"),
                  DUCKDB_TEMP_DIR=os.path.join(TMP, "spill"), DISK_USAGE_LIMIT_PCT="95")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))


def peak_rss_mb() -> float:
    """Peak working set of this process (Windows; falls back to resource on POSIX)."""
    if os.name == "nt":
        class PMC(ctypes.Structure):
            _fields_ = [("cb", ctypes.c_ulong), ("PageFaultCount", ctypes.c_ulong)] + [
                (n, ctypes.c_size_t) for n in ("PeakWorkingSetSize", "WorkingSetSize", "QuotaPeakPagedPoolUsage",
                                               "QuotaPagedPoolUsage", "QuotaPeakNonPagedPoolUsage",
                                               "QuotaNonPagedPoolUsage", "PagefileUsage", "PeakPagefileUsage")]
        c = PMC()
        c.cb = ctypes.sizeof(PMC)
        k32 = ctypes.windll.kernel32
        k32.GetCurrentProcess.restype = ctypes.c_void_p
        k32.K32GetProcessMemoryInfo.argtypes = [ctypes.c_void_p, ctypes.c_void_p, ctypes.c_ulong]
        k32.K32GetProcessMemoryInfo(k32.GetCurrentProcess(), ctypes.byref(c), c.cb)
        return c.PeakWorkingSetSize / 2**20
    import resource
    return resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024


def timed(fn, runs: int) -> float:
    ts = []
    for _ in range(runs):
        t0 = time.perf_counter()
        fn()
        ts.append((time.perf_counter() - t0) * 1000)
    return statistics.median(ts)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--sizes", default="10000,1000000,5000000")
    ap.add_argument("--runs", type=int, default=5)
    args = ap.parse_args()
    from app.core.store import store
    from app.services.engine import QueryEngine
    eng = QueryEngine(os.environ["ANALYTICS_DB"])
    rows: list[tuple] = []
    with eng.writer() as c:
        c.execute("CREATE TABLE dim AS SELECT i AS k, 'cat_' || i AS name FROM range(1000) r(i)")
    for n in (int(s) for s in args.sizes.split(",")):
        path = os.path.join(TMP, f"f{n}.parquet").replace("\\", "/")
        with eng.writer() as c:
            c.execute(f"""COPY (SELECT i AS id, i % 1000 AS k, (i * 7919) % 50000 AS cust,
                       DATE '2024-01-01' + CAST(i % 730 AS INTEGER) AS d, (i % 997) * 1.25 AS amount,
                       'region_' || (i % 12) AS region FROM range({n}) r(i))
                       TO '{path}' (FORMAT parquet, COMPRESSION zstd)""")
            c.execute(f"CREATE OR REPLACE VIEW f{n} AS SELECT * FROM read_parquet('{path}')")
        qs = {
            "agg": f"SELECT SUM(amount), AVG(amount), COUNT(DISTINCT cust) FROM f{n}",
            "groupby": f"SELECT region, date_trunc('month', d) m, SUM(amount) s FROM f{n} GROUP BY 1, 2 ORDER BY 1, 2",
            "join": f"SELECT dim.name, SUM(f.amount) s FROM f{n} f JOIN dim ON f.k = dim.k GROUP BY 1 ORDER BY 2 DESC LIMIT 20",
            "rows10k": f"SELECT * FROM f{n}",  # default row cap -> 10k dicts materialised
        }
        for name, q in qs.items():
            rows.append((n, name, timed(lambda: eng.execute(q, fresh=True), args.runs)))
        def conc(threads: int) -> float:
            t0 = time.perf_counter()
            with ThreadPoolExecutor(threads) as ex:
                list(ex.map(lambda i: eng.execute(qs["groupby"] + f" LIMIT {1000 + i}", fresh=True), range(16)))
            return (time.perf_counter() - t0) * 1000
        rows.append((n, "16x groupby, 1 thread", conc(1)))
        rows.append((n, "16x groupby, 8 threads", conc(8)))
        if n >= 1_000_000:
            t0 = time.perf_counter()
            r = eng.execute(f"SELECT * FROM f{n} LIMIT 1000000", fresh=True)
            rows.append((n, f"explicit LIMIT 1M -> {r['row_count']} rows", (time.perf_counter() - t0) * 1000))
        rows.append((n, "peak RSS MB (cumulative)", peak_rss_mb()))
    t0 = time.perf_counter()
    for i in range(200):
        store.insert("audit_log", {"action": "bench", "detail": str(i)})
    rows.append(("-", "metadata insert (per op)", (time.perf_counter() - t0) * 1000 / 200))
    t0 = time.perf_counter()
    for _ in range(200):
        store.list("datasets", order=None)
    rows.append(("-", "metadata list (per op)", (time.perf_counter() - t0) * 1000 / 200))
    print(f"{'rows':>9} | {'case':<34} | ms / MB")
    for n, name, v in rows:
        print(f"{n!s:>9} | {name:<34} | {v:,.1f}")
    eng.close()


if __name__ == "__main__":
    try:
        main()
    finally:
        try:
            from app.core.store import store
            store._base and store._base.close()
        except Exception:
            pass
        shutil.rmtree(TMP, ignore_errors=True)
