"""One command to check everything before anything goes to the server.

    backend\\.venv\\Scripts\\python.exe scripts\\verify.py            (Windows, or run verify.bat)
    python scripts/verify.py [--skip test_remote,...] [--quick]

Runs: every backend test in a throwaway database (never your real data), the multi-user isolation test (login ON), the
frontend tests, the production frontend build (the exact step the server runs) and the file-size rule.
Exit code 0 = safe to deploy; anything else = do not.
"""
import argparse
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND, FRONTEND = ROOT / "backend", ROOT / "frontend"
# needs the real datasets in backend/data (not hermetic): run it by hand if you want it
ALWAYS_SKIP = {"test_refresh"}


def run(cmd: list[str], cwd: Path, env: dict | None = None, timeout: int = 600) -> tuple[bool, str]:
    try:
        p = subprocess.run(cmd, cwd=cwd, env=env, capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        return False, f"timed out after {timeout}s"
    except FileNotFoundError as e:
        return False, f"not found: {e}"
    out = ((p.stdout or "") + (p.stderr or "")).strip()
    return p.returncode == 0, "\n".join(out.splitlines()[-12:])


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--skip", default="", help="comma-separated test names to skip, e.g. test_remote")
    ap.add_argument("--quick", action="store_true", help="backend tests only (no frontend build)")
    args = ap.parse_args()
    skip = ALWAYS_SKIP | {s.strip() for s in args.skip.split(",") if s.strip()}
    results: list[tuple[str, bool, str]] = []
    t0 = time.time()

    for test in sorted((BACKEND / "tests").glob("test_*.py")):
        name = test.stem
        if name in skip:
            print(f"  skip  {name}")
            continue
        tmp = tempfile.mkdtemp(prefix="dashtor_verify_")
        env = dict(os.environ, METADATA_DB=f"{tmp}/m.duckdb", ANALYTICS_DB=f"{tmp}/a.duckdb",
                   UPLOAD_DIR=f"{tmp}/up", DUCKDB_TEMP_DIR=f"{tmp}/sp")
        ok, tail = run([sys.executable, str(test)], BACKEND, env, timeout=300)
        shutil.rmtree(tmp, ignore_errors=True)
        results.append((f"backend  {name}", ok, tail))
        print(f"  {'PASS' if ok else 'FAIL'}  {name}", flush=True)

    if not args.quick:
        npm = shutil.which("npm")
        if not npm:
            results.append(("frontend npm", False, "npm not found on PATH"))
        else:
            for label, cmd in (("frontend tests", [npm, "test"]), ("frontend production build", [npm, "run", "build"])):
                ok, tail = run(cmd, FRONTEND)
                results.append((label, ok, tail))
                print(f"  {'PASS' if ok else 'FAIL'}  {label}", flush=True)
        ok, tail = run([sys.executable, str(ROOT / "scripts" / "check_file_sizes.py")], ROOT)
        results.append(("file sizes", ok, tail))
        print(f"  {'PASS' if ok else 'FAIL'}  file sizes", flush=True)

    failed = [r for r in results if not r[1]]
    print(f"\n{len(results) - len(failed)}/{len(results)} checks passed in {time.time() - t0:.0f}s")
    for label, _, tail in failed:
        print(f"\n--- FAILED: {label}\n{tail}")
    print("\nRESULT: " + ("ALL GOOD - safe to deploy" if not failed else "NOT SAFE - fix the failures above first"))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
