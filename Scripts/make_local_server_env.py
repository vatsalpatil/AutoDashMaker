"""Build backend/.env.local-server (git-ignored): the live server's settings, adapted so localhost behaves like a real user's visit.

    backend\\.venv\\Scripts\\python.exe Scripts\\make_local_server_env.py

Reads backend/.env.dokploy (the paste-ready copy of the server's environment) and changes only what must differ on a PC:
the site address (links in emails point at localhost), CORS, and the disk limit. Secrets are copied, never printed.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC, DST = ROOT / "backend" / ".env.dokploy", ROOT / "backend" / ".env.local-server"
OVERRIDE = {
    "APP_URL": "http://localhost:5174",     # the confirmation link in the email opens the local site
    "DISK_USAGE_LIMIT_PCT": "95",           # this PC's disk is more than 80 % full
    "PORT": "8000",
}
DROP = {"CORS_ORIGINS"}                      # the live address; the built-in localhost origins are right here


def main() -> int:
    if not SRC.exists():
        print(f"{SRC.name} is missing; it holds the server's settings this file is built from.")
        return 1
    seen: set[str] = set()
    lines = ["# Local run with the server's settings (git-ignored). Built by Scripts/make_local_server_env.py"]
    for raw in SRC.read_text(encoding="utf-8").splitlines():
        if "=" not in raw or raw.lstrip().startswith("#"):
            continue
        key, value = raw.split("=", 1)
        key = key.strip()
        if key in DROP or key in seen:
            continue
        seen.add(key)
        lines.append(f"{key}={OVERRIDE.get(key, value)}")
    for key, value in OVERRIDE.items():
        if key not in seen:
            lines.append(f"{key}={value}")
    DST.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {DST.name} with {len(lines) - 1} settings (values not shown).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
