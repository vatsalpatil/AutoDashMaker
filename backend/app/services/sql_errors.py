"""Turn raw DuckDB errors into plain messages that point at the user's own tables and columns."""
import difflib
import re

from ..core.store import store


def _suggest(word: str, names: set[str]) -> str:
    near = difflib.get_close_matches(word, names, n=1, cutoff=0.5)
    return f". Did you mean '{near[0]}'?" if near else ""


def _columns_for(sql: str | None) -> set[str]:
    """Column names of the tables the query uses (all columns when the query is unknown), so a typo is matched
    against what the user could have meant, not a column of some other dataset."""
    words = set(re.findall(r"[A-Za-z_][A-Za-z0-9_]*", (sql or "").lower()))
    used = [d["id"] for d in store.list("datasets", order=None)
            if sql and ((d.get("name") or "").lower() in words or (d.get("physical_name") or "").lower() in words)]
    if not used:
        return {c["name"] for c in store.list("columns_meta", order=None)}
    rows = store.list("columns_meta", where=f"dataset_id IN ({','.join('?' * len(used))})", params=used, order=None)
    return {c["name"] for c in rows}


def friendly(err: str, sql: str | None = None) -> str:
    m = re.search(r'column "([^"]+)" must appear in the GROUP BY clause', err)
    if m:
        return (f"'{m.group(1)}' is shown next to a total, so it must be grouped: add it to GROUP BY (or write GROUP BY ALL), "
                "or wrap it in SUM / COUNT / MAX.")
    if "Binder Error" in err:
        m = re.search(r'[Cc]olumn "([^"]+)"', err)
        if m:
            names = _columns_for(sql)
            if m.group(1) not in names:
                return f"column '{m.group(1)}' does not exist" + _suggest(m.group(1), names)
    m = re.search(r"Table with name (\S+) does not exist", err)
    if m:   # DuckDB suggests its own catalog tables (pg_enum...): suggest the user's datasets instead
        tables = {d["name"] for d in store.list("datasets", order=None) if d.get("physical_name")}
        return f"table '{m.group(1)}' does not exist" + _suggest(m.group(1), tables)
    return _plain(err)


def _plain(err: str) -> str:
    """Drop DuckDB's caret-pointer block and its error-class prefix; show dataset names, never internal ds_ tables."""
    text = re.split(r"\n\s*LINE \d+:", err)[0].strip()
    text = re.sub(r"^(Conversion|Binder|Parser|Catalog|Invalid Input|Out of Range) Error:\s*", "", text)
    for d in store.list("datasets", order=None):
        if d.get("physical_name") and d["physical_name"] in text:
            text = text.replace(d["physical_name"], d["name"])
    return text


def unsafe(e: Exception) -> str:
    """Plain message for a query the read-only guard refused."""
    msg = str(e)
    m = re.search(r"Statement type not allowed: (\w+)", msg)
    if m:
        return f"Only read queries (SELECT or WITH) can run here; {m.group(1).upper()} is not allowed. Your data can't be changed from SQL."
    m = re.search(r"does not parse: (.+)", msg)
    if m:
        return f"SQL syntax error: {m.group(1).strip()} Check brackets, commas and quotes near that spot."
    return f"This query was blocked for safety: {msg}"
