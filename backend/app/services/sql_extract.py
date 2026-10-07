"""Pull a single SQL statement out of a model reply (markdown fences, thinking transcripts, ANSI noise)."""
from __future__ import annotations

import re

_ANSI = re.compile(r"\x1b\[[0-9;]*[A-Za-z]|\[\d+(?:;\d+)*m")
_THINK = re.compile(r"<(think|thinking|reasoning)>.*?</\1>", re.DOTALL | re.IGNORECASE)
_FENCE = re.compile(r"```(?:sql|duckdb)?\s*(.*?)```", re.DOTALL | re.IGNORECASE)
_REASONING = re.compile(r"thinking process|\*\*analy[sz]e|let me think|\*\*constraints|step[- ]by[- ]step", re.IGNORECASE)
_STMT_START = re.compile(r"^[ \t>*-]*(with|select)\b", re.IGNORECASE | re.MULTILINE)


_SQL_KEYWORD = re.compile(
    r"^\s*(with|select|from|values|summarize|explain|show|describe|insert|update|delete|drop|create|alter|"
    r"attach|detach|copy|pragma|set|truncate|merge|\()", re.IGNORECASE)


def _parses(sql: str) -> bool:
    """True for something that is a real SQL statement (a bare word like NOT_A_QUERY parses as a column)."""
    import sqlglot
    if not _SQL_KEYWORD.match(sql or ""):
        return False
    try:
        return bool(sqlglot.parse_one(sql, read="duckdb"))
    except Exception:
        return False


def extract_sql(text: str) -> str:
    """Pull one SQL statement out of a model reply that may include reasoning, fences or terminal junk.

    Preference: last fenced block that parses > last line-start SELECT/WITH that parses > cleaned text.
    """
    text = _THINK.sub("", _ANSI.sub("", text or "")).strip()
    for block in reversed(_FENCE.findall(text)):
        block = block.strip().rstrip(";").strip()
        if block and _parses(block):
            return block
    reasoning = bool(_REASONING.search(text))
    for m in reversed(list(_STMT_START.finditer(text))):
        tail = text[m.start():].lstrip(" \t>*-")
        if ";" in tail:
            cand, after = tail.split(";", 1)
        else:
            parts = re.split(r"\n\s*\n", tail, maxsplit=1)
            cand, after = parts[0], (parts[1] if len(parts) > 1 else "")
        cand = cand.strip().strip("`").strip()
        # In a reasoning transcript a statement followed by more prose is just quoted context
        # (e.g. the editor's current SQL), not the answer.
        if reasoning and after.strip().strip("`").strip():
            continue
        if _parses(cand):
            return cand
    return text.removeprefix("```sql").removeprefix("```").removesuffix("```").strip()
