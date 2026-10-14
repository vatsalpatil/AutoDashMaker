"""Parameters in saved SQL: `{{name|default}}` placeholders that dashboards (or any caller) fill at run time.

Examples:  DATE_TRUNC('{{period|month}}', order_date)      WHERE return_rate >= {{min_rate|30}}
Values are never trusted: a value must be a number or a short plain word/date (letters, digits, space, _ . : -), so it
cannot close a quote, start a comment or add a statement. The rendered SQL still goes through validate_readonly.
"""
from __future__ import annotations

import re
from typing import Any

PLACEHOLDER = re.compile(r"\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*(?:\|\s*([^{}]*?))?\s*\}\}")
_SAFE = re.compile(r"^-?\d+(\.\d+)?$|^[A-Za-z0-9][A-Za-z0-9 _.:\-]{0,60}$")


class ParamError(ValueError):
    pass


def names(sql: str) -> list[dict[str, str]]:
    """The placeholders a query uses, with their inline defaults (for building controls)."""
    seen: dict[str, str] = {}
    for m in PLACEHOLDER.finditer(sql or ""):
        seen.setdefault(m.group(1), (m.group(2) or "").strip())
    return [{"name": k, "default": v} for k, v in seen.items()]


def render(sql: str, values: dict[str, Any] | None = None) -> str:
    """Replace every placeholder with its value (or inline default). Raises ParamError on a missing or unsafe value."""
    if "{{" not in (sql or ""):
        return sql
    values = values or {}

    def one(m: re.Match) -> str:
        name, default = m.group(1), (m.group(2) or "").strip()
        v = values.get(name)
        v = default if v is None or str(v).strip() == "" else str(v).strip()
        if v == "":
            raise ParamError(f"parameter '{name}' needs a value (or a default: {{{{{name}|value}}}})")
        if not _SAFE.match(v):
            raise ParamError(f"parameter '{name}' has an unsafe value; use a number, word or date")
        return v

    return PLACEHOLDER.sub(one, sql)
