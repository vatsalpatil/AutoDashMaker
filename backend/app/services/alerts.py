"""Moved to app/domains/monitor/alerts.py. This alias keeps old imports working (same module object)."""
import sys

from ..domains.monitor import alerts as _m

sys.modules[__name__] = _m
