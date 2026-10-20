"""Auto-switch: the order in which connected providers/keys are tried for a call.

The active provider goes first while it has more than `switch_below` % of its daily limit left (and is not paused).
Below that — with auto-switch on — the key/provider with the most left goes first, so several keys of the same
provider are used up one after another instead of failing. The rest always follow as fallbacks.
"""
from __future__ import annotations

from typing import Any

from ..core.store import store


def _rank(cfg: dict[str, Any]) -> float:
    from .ai_usage import pct_left
    pct = pct_left(cfg)
    return 100.0 if pct is None else float(pct)   # no fixed cap counts as full


def order(active: dict[str, Any]) -> list[dict[str, Any]]:
    """Providers to try, best first (the active one included)."""
    others = [p for p in store.list("ai_providers", order="created_at") if p["id"] != active.get("id")]
    if active.get("auto_switch") is False:
        return [active, *others]
    threshold = active.get("switch_below") if active.get("switch_below") is not None else 5
    ranked = sorted(others, key=_rank, reverse=True)
    if _rank(active) > threshold:
        return [active, *ranked]
    return sorted([active, *ranked], key=_rank, reverse=True)
