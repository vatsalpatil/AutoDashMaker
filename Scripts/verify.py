"""One command to check everything before anything goes to the server.

    backend\\.venv\\Scripts\\python.exe Scripts\\verify.py            (Windows, or run verify.bat)
    python Scripts/verify.py [--skip test_remote,...] [--only test_alerts,...] [--quick] [--jobs N]

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


def _backend_test(test: Path) -> tuple[str, bool, str]:
    """One test file in its own process and throwaway database (so any number can run side by side)."""
    tmp = tempfile.mkdtemp(prefix="dashtor_verify_")
    env = dict(os.environ, METADATA_DB=f"{tmp}/m.duckdb", ANALYTICS_DB=f"{tmp}/a.duckdb",
               UPLOAD_DIR=f"{tmp}/up", DUCKDB_TEMP_DIR=f"{tmp}/sp", DISK_USAGE_LIMIT_PCT=os.environ.get("DISK_USAGE_LIMIT_PCT", "99"))
    try:
        ok, tail = run([sys.executable, str(test)], BACKEND, env, timeout=300)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    return f"backend  {test.stem}", ok, tail


def _frontend_and_sizes() -> list[tuple[str, bool, str]]:
    out = []
    npm = shutil.which("npm")
    if not npm:
        out.append(("frontend npm", False, "npm not found on PATH"))
    else:
        for label, cmd in (("frontend tests", [npm, "test"]), ("frontend production build", [npm, "run", "build"])):
            ok, tail = run(cmd, FRONTEND)
            out.append((label, ok, tail))
            print(f"  {'PASS' if ok else 'FAIL'}  {label}", flush=True)
    for label, script in (("file sizes", "check_file_sizes.py"), ("api types up to date", "gen_api_types.py")):
        if (ROOT / "Scripts" / script).exists():
            ok, tail = run([sys.executable, str(ROOT / "Scripts" / script), *(["--check"] if script == "gen_api_types.py" else [])], ROOT)
            out.append((label, ok, tail))
            print(f"  {'PASS' if ok else 'FAIL'}  {label}", flush=True)
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--skip", default="", help="comma-separated test names to skip, e.g. test_remote")
    ap.add_argument("--only", default="", help="run only these backend tests (comma-separated names or prefixes), e.g. test_alerts,test_quality")
    ap.add_argument("--quick", action="store_true", help="backend tests only (no frontend build)")
    ap.add_argument("--jobs", type=int, default=max(2, (os.cpu_count() or 4) - 1), help="backend tests run side by side (default: cores - 1)")
    args = ap.parse_args()
    skip = ALWAYS_SKIP | {s.strip() for s in args.skip.split(",") if s.strip()}
    only = [s.strip() for s in args.only.split(",") if s.strip()]
    tests = [t for t in sorted((BACKEND / "tests").glob("test_*.py"))
             if t.stem not in skip and (not only or any(t.stem.startswith(o) for o in only))]
    results: list[tuple[str, bool, str]] = []
    t0 = time.time()

    from concurrent.futures import ThreadPoolExecutor, as_completed
    with ThreadPoolExecutor(max_workers=args.jobs + 1) as pool:
        # the frontend build (slowest single step) runs while the backend tests do
        front = pool.submit(_frontend_and_sizes) if not (args.quick or only) else None
        futures = [pool.submit(_backend_test, t) for t in tests]
        for f in as_completed(futures):
            label, ok, tail = f.result()
            results.append((label, ok, tail))
            print(f"  {'PASS' if ok else 'FAIL'}  {label.split()[-1]}", flush=True)
        if front:
            results += front.result()

    failed = [r for r in results if not r[1]]
    print(f"\n{len(results) - len(failed)}/{len(results)} checks passed in {time.time() - t0:.0f}s")
    for label, _, tail in failed:
        print(f"\n--- FAILED: {label}\n{tail}")
    print("\nRESULT: " + ("ALL GOOD - safe to deploy" if not failed else "NOT SAFE - fix the failures above first"))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
