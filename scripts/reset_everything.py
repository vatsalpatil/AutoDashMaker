"""Start completely clean: delete every user and all data. YOU run this; nothing else ever calls it.

    backend\\.venv\\Scripts\\python.exe scripts\\reset_everything.py              (dry run: only lists what would go)
    backend\\.venv\\Scripts\\python.exe scripts\\reset_everything.py --execute    (asks you to type a phrase first)

What it removes (run it on the machine whose backend you want to reset; it reads backend/.env):
  1. every Supabase sign-in account (GoTrue admin API; needs SUPABASE_URL + SUPABASE_SERVICE_KEY)   [skip: --keep-accounts]
  2. all local data: backend/data/*.duckdb (+ per-user ws/), backend/uploads/ (datasets, reports, certificates)
Before deleting, backend/data and backend/uploads are copied to _backups/reset-<time>/ (git-ignored) unless --no-backup.
backend/.env is never touched. NOTE: the AI provider keys live in metadata.duckdb, so they go too (they stay in the backup).
"""
import argparse
import shutil
import sys
import time
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
DATA, UPLOADS = ROOT / "backend" / "data", ROOT / "backend" / "uploads"
PHRASE = "DELETE EVERYTHING"


def env() -> dict:
    out = {}
    f = ROOT / "backend" / ".env"
    for line in f.read_text(encoding="utf-8").splitlines() if f.exists() else []:
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip()
    return out


def size(p: Path) -> int:
    return sum(f.stat().st_size for f in p.rglob("*") if f.is_file()) if p.exists() else 0


def auth_users(cfg: dict) -> tuple[list[dict], dict]:
    if not (cfg.get("SUPABASE_URL") and cfg.get("SUPABASE_SERVICE_KEY")):
        return [], {}
    hdr = {"apikey": cfg["SUPABASE_SERVICE_KEY"], "Authorization": f"Bearer {cfg['SUPABASE_SERVICE_KEY']}"}
    base = cfg["SUPABASE_URL"].rstrip("/") + "/auth/v1/admin/users"
    users, page = [], 1
    while True:
        r = httpx.get(base, params={"page": page, "per_page": 200}, headers=hdr, timeout=30)
        r.raise_for_status()
        batch = r.json().get("users", [])
        users += batch
        if len(batch) < 200:
            return users, {"base": base, "hdr": hdr}
        page += 1


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--execute", action="store_true")
    ap.add_argument("--keep-accounts", action="store_true", help="do not touch Supabase sign-in accounts")
    ap.add_argument("--no-backup", action="store_true")
    a = ap.parse_args()
    cfg = env()

    users, conn = ([], {}) if a.keep_accounts else auth_users(cfg)
    files = sorted(DATA.glob("*.duckdb*")) + ([DATA / "ws"] if (DATA / "ws").exists() else [])
    print(f"Sign-in accounts to delete : {len(users)}" + ("" if users or a.keep_accounts else "  (no SUPABASE_SERVICE_KEY in backend/.env, or none exist)"))
    print(f"Data folder                : {size(DATA) / 1e6:.1f} MB  ({', '.join(p.name for p in files) or 'empty'})")
    print(f"Uploads folder             : {size(UPLOADS) / 1e6:.1f} MB")
    if not a.execute:
        print("\nDry run only. Nothing was deleted. Add --execute to reset.")
        return 0
    if input(f'\nThis cannot be undone. Type "{PHRASE}" to continue: ').strip() != PHRASE:
        print("Cancelled.")
        return 1

    if not a.no_backup:
        dest = ROOT / "_backups" / time.strftime("reset-%Y%m%d-%H%M%S")
        dest.mkdir(parents=True)
        for src in (DATA, UPLOADS):
            if src.exists():
                shutil.copytree(src, dest / src.name, ignore=shutil.ignore_patterns("tmp"))
        print(f"Backup saved to {dest}")
    for u in users:
        httpx.delete(f"{conn['base']}/{u['id']}", headers=conn["hdr"], timeout=30).raise_for_status()
    for p in files:
        shutil.rmtree(p) if p.is_dir() else p.unlink()
    shutil.rmtree(UPLOADS, ignore_errors=True)
    UPLOADS.mkdir(exist_ok=True)
    print(f"Deleted {len(users)} accounts and all local data. Restart the backend; it creates fresh empty databases.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
