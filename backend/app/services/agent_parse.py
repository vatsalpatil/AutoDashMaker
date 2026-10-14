"""Turn a model's reply into the agent's next move. Models answer in different shapes, so accept the common ones:

1. Our JSON        {"thought": "...", "tool": "run_sql", "args": {"sql": "..."}}
2. Function JSON   {"name": "run_sql", "arguments": {...}}   (OpenAI / Hermes style, args may be a JSON string)
3. Python-style    [run_sql(sql="SELECT 1")]  often wrapped in <|tool_call_start|> ... <|tool_call_end|> or <tool_call> tags
4. Plain prose     -> a final answer, unless it still carries tool-call markup (then None: the caller asks again)
"""
from __future__ import annotations

import ast
import json
import re
from typing import Any

from .dash_ai import json_objects
from .sql_extract import _ANSI, _THINK

TOOLS = {"list_tables", "describe_table", "sample_rows", "run_sql", "add_cell", "edit_cell", "final"}
_MARKUP = re.compile(r"<\|?/?tool_call[^>]*\|?>|</?tool_call>|<\|tool_call_(start|end)\|>", re.I)
_PYCALL = re.compile(r"\b(" + "|".join(sorted(TOOLS)) + r")\s*\((.*?)\)\s*\]?\s*(?:<|$)", re.S)


def _args(v: Any) -> dict[str, Any]:
    if isinstance(v, str):
        try:
            v = json.loads(v)
        except ValueError:
            return {}
    return v if isinstance(v, dict) else {}


def _pycall(text: str) -> dict[str, Any] | None:
    """`name(a="x", n=5)` -> move, parsing keyword arguments safely (literals only, nothing is executed)."""
    m = _PYCALL.search(text)
    if not m:
        return None
    try:
        call = ast.parse(f"f({m.group(2)})", mode="eval").body
        args = {k.arg: ast.literal_eval(k.value) for k in call.keywords if k.arg}  # type: ignore[attr-defined]
    except (SyntaxError, ValueError):
        return None
    return {"tool": m.group(1), "args": args, "thought": ""}


def parse_move(raw: str) -> dict[str, Any] | None:
    """The next move, or None when the reply holds no usable step."""
    text = _THINK.sub("", _ANSI.sub("", raw or "")).strip()
    for obj in reversed(json_objects(text)):
        if isinstance(obj.get("tool"), str):
            return obj
        name = obj.get("name") or (obj.get("function") or {}).get("name")
        if name in TOOLS:
            return {"tool": name, "args": _args(obj.get("arguments") or obj.get("parameters") or (obj.get("function") or {}).get("arguments")),
                    "thought": str(obj.get("thought", ""))}
    if (move := _pycall(text)) is not None:
        return move
    if not text or text[:1] in "{[" or _MARKUP.search(text):
        return None
    return {"tool": "final", "args": {"answer": text}, "thought": ""}
