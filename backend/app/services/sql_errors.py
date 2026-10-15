"""Turn raw DuckDB errors into plain messages that point at the user's own tables and columns."""
import difflib
import re

from ..core.store import store


def _suggest(word: str, names: set[str]) -> str:
    near = difflib.get_close_matches(word, names, n=1, cutoff=0.5)
    return f". Did you mean '{near[0]}'?" if near else ""


def friendly(err: str) -> str:
    if "Binder Error" in err:
        m = re.search(r'[Cc]olumn "([^"]+)"', err)
        if m:
            names = {c["name"] for c in store.list("columns_meta", order=None)}
            if m.group(1) not in names:
                return f"column '{m.group(1)}' does not exist" + _suggest(m.group(1), names)
    m = re.search(r"Table with name (\S+) does not exist", err)
    if m:   # DuckDB suggests its own catalog tables (pg_enum...): suggest the user's datasets instead
        tables = {d["name"] for d in store.list("datasets", order=None) if d.get("physical_name")}
        return f"table '{m.group(1)}' does not exist" + _suggest(m.group(1), tables)
    return err
