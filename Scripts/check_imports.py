"""Import boundaries (run by verify.py). Layers, lowest first:

    core  <-  services  <-  domains/<name>  <-  routers / Main

- core imports nothing from services, routers or domains (it is the shared kernel).
- A domain may import core, services and another domain's package API (`app.domains.x` or its public modules listed in
  that package's __init__ docstring), never a sibling's private helpers (names starting with `_`).
- services/routers may import a domain only through its modules (the old-path aliases do exactly that).
Fails with the offending file:line so a cycle or a layering slip shows up in review, not at runtime.
"""
import re
import sys
from pathlib import Path

APP = Path(__file__).resolve().parents[1] / "backend" / "app"
IMPORT = re.compile(r"^\s*from\s+(\.+)([\w.]*)\s+import\s+(.+)$")


def target(path: Path, dots: str, mod: str) -> str:
    """Absolute dotted module (relative to app) an import refers to."""
    pkg = list(path.relative_to(APP).parent.parts)
    up = len(dots) - 1
    base = pkg[: len(pkg) - up] if up else pkg
    return ".".join([*base, *([mod] if mod else [])])


def main() -> int:
    errors = []
    for path in APP.rglob("*.py"):
        if "__pycache__" in path.parts:
            continue
        rel = path.relative_to(APP).parts
        for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            m = IMPORT.match(line)
            if not m:
                continue
            dest = target(path, m.group(1), m.group(2))
            where = f"{path.relative_to(APP.parent).as_posix()}:{n}"
            if rel[0] == "core" and dest.split(".")[0] in ("services", "routers", "domains"):
                errors.append(f"{where}: core must not import {dest}")
            if rel[0] == "domains" and dest.startswith("domains.") and len(rel) > 1 and dest.split(".")[1] != rel[1]:
                if any(name.strip().startswith("_") for name in m.group(3).split(",")):
                    errors.append(f"{where}: private name imported from another domain ({dest})")
    for e in errors:
        print(e)
    print(f"import boundaries: {len(errors)} problem(s)")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
