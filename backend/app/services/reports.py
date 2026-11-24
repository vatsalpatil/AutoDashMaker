"""Moved to app/domains/monitor/reports.py. This alias keeps old imports working (same module object)."""
import sys

from ..domains.monitor import reports as _m

sys.modules[__name__] = _m
