"""Name-based column hints shared by the suggestion features (starter questions, metric suggestions)."""
import re

# keys and calendar parts: numeric, but summing or grouping by them is rarely what anyone wants
IDLIKE = re.compile(r"(^|_)(id|uuid|key|code)$|^(year|month|day|week|day_of_week|quarter|hour)$", re.IGNORECASE)
# business measures: suggested first
MONEY = re.compile(r"revenue|sales|amount|profit|total|price|cost|quantity|qty", re.IGNORECASE)
# per-unit values: averaging them makes sense, summing them does not
PER_UNIT = re.compile(r"price|rate|pct|percent|ratio|age|discount|score|avg|mean|_g$|weight|unit_cost|^cost$|_per_", re.IGNORECASE)


def business_first(names: list[str]) -> list[str]:
    return sorted(names, key=lambda n: not MONEY.search(n))   # stable: keeps column order within each group


_DATEISH = re.compile(r"DATE|TIMESTAMP", re.IGNORECASE)
_KEY = re.compile(r"(^|_)id$|^id$|uuid|key$", re.IGNORECASE)


def is_lookup(cols: list[dict], row_count: int | None) -> bool:
    """One row per thing (products, customers) rather than events: a unique id column and no date column.
    Totals of such a table's prices/costs mean nothing; counts and breakdowns do."""
    if any(_DATEISH.search(c.get("dtype") or "") for c in cols):
        return False
    return any(_KEY.search(c["name"]) and c.get("distinct_count") and c["distinct_count"] >= (row_count or 0) > 0 for c in cols)
