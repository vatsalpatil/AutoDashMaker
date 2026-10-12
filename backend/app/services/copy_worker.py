"""Child process: stream one remote table into a Parquet file.  Run as `python -m app.services.copy_worker` (see remote.convert_to_copy).

Why a separate process: copying a big remote table is the heaviest thing the app does. In the API server's own process, a memory
spike or a crash inside DuckDB's MySQL/Postgres scanner would take the whole site down (every request fails with 502). Here it
can only fail the copy, and the parent reports why. The worker also never stages the rows in a database file: `COPY (SELECT ...)`
streams them chunk by chunk straight into zstd Parquet, so its memory stays small whatever the table size.

The parent starts it with METADATA_DB pointing at a throwaway file: importing the app package opens its metadata database, and the server
already holds the real one (DuckDB allows a single process per file).

Input (JSON on stdin, so passwords never appear in a process list): {type, config, remote, out, workspace, memory_limit, threads, temp_dir}
Output (one JSON line on stdout): {rows, columns: [{name, dtype}]}.  Any failure: message on stderr, exit code 1.
"""
from __future__ import annotations

import json
import os
import sys
import tempfile


def _quote(name: str) -> str:
    return ".".join('"' + part.replace('"', '""') + '"' for part in name.split("."))


def main() -> int:
    spec = json.loads(sys.stdin.read())
    scratch = tempfile.mkdtemp(prefix="copy_worker_")
    import duckdb

    from app.connectors import get_connector
    from app.core import tenant

    if spec.get("workspace"):
        tenant.set_workspace(spec["workspace"])   # file sources are confined to the user's own uploads
    con = duckdb.connect(config={
        "memory_limit": spec.get("memory_limit", "1GB"),
        "threads": int(spec.get("threads", 2)),
        "preserve_insertion_order": False,
        "temp_directory": (spec.get("temp_dir") or scratch).replace("\\", "/"),
    })
    alias = get_connector(spec["type"], spec["config"]).attach(con, "copy_src")
    out = spec["out"].replace("\\", "/").replace("'", "''")
    con.execute(f"COPY (SELECT * FROM {alias}.{_quote(spec['remote'])}) TO '{out}' (FORMAT parquet, COMPRESSION zstd)")
    columns = [{"name": r[0], "dtype": r[1]} for r in con.execute(f"DESCRIBE SELECT * FROM read_parquet('{out}')").fetchall()]
    rows = int(con.execute(f"SELECT COUNT(*) FROM read_parquet('{out}')").fetchone()[0])
    sys.stdout.write(json.dumps({"rows": rows, "columns": columns}) + "\n")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:   # the parent shows this text (it scrubs secrets); never a traceback to the user
        sys.stderr.write(f"{type(e).__name__}: {e}\n")
        sys.exit(1)
