"""File-size guard: keep hand-written files small enough to understand and edit in one sitting.

    python scripts/check_file_sizes.py            # report files over budget
    python scripts/check_file_sizes.py --strict   # also exit 1 if any file is over the HARD limit

Budget: WARN above 250 lines, HARD limit 400. Split by responsibility (component / hook / model / service),
not by arbitrary line count. Generated code is excluded: shadcn (components/ui) and ReUI (components/reui).
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SCAN = [ROOT / "frontend" / "src", ROOT / "backend" / "app", ROOT / "backend" / "tests"]
SUFFIXES = {".ts", ".tsx", ".py", ".css"}
SKIP_PARTS = {"node_modules", ".venv", "__pycache__", "dist"}
GENERATED = [("frontend", "src", "components", "ui"), ("frontend", "src", "components", "reui")]
WARN, HARD = 250, 400


def is_generated(path: pathlib.Path) -> bool:
    parts = path.relative_to(ROOT).parts
    return any(parts[: len(g)] == g for g in GENERATED)


def main() -> int:
    rows = []
    for base in SCAN:
        for path in base.rglob("*"):
            if path.suffix not in SUFFIXES or SKIP_PARTS & set(path.parts) or is_generated(path):
                continue
            n = sum(1 for _ in path.open(encoding="utf-8", errors="ignore"))
            if n > WARN:
                rows.append((n, path.relative_to(ROOT).as_posix()))
    rows.sort(reverse=True)
    for n, rel in rows:
        print(f"{'OVER ' if n > HARD else 'warn '} {n:5d}  {rel}")
    over = [r for r in rows if r[0] > HARD]
    print(f"\n{len(rows)} file(s) above {WARN} lines, {len(over)} above the hard limit of {HARD}.")
    return 1 if (over and "--strict" in sys.argv) else 0


if __name__ == "__main__":
    sys.exit(main())
