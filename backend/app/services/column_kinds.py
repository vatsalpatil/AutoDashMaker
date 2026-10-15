"""Name-based column hints shared by the suggestion features (starter questions, metric suggestions)."""
import re

# keys and calendar parts: numeric, but summing or grouping by them is rarely what anyone wants
IDLIKE = re.compile(r"(^|_)(id|uuid|key|code)$|^(year|month|day|week|day_of_week|quarter|hour)$", re.IGNORECASE)
# business measures: suggested first
MONEY = re.compile(r"revenue|sales|amount|profit|total|price|cost|quantity|qty", re.IGNORECASE)
# per-unit values: averaging them makes sense, summing them does not
PER_UNIT = re.compile(r"price|rate|pct|percent|ratio|age|discount|score|avg|mean|_g$|weight", re.IGNORECASE)


def business_first(names: list[str]) -> list[str]:
    return sorted(names, key=lambda n: not MONEY.search(n))   # stable: keeps column order within each group
