"""Brute-force lockout: 20 wrong attempts within 10 minutes block that key for 10 minutes.

A "key" is whatever is being guessed at (`login:email:<addr>`, `login:ip:<ip>`, `otp:<user id>`). State lives in
this process's memory, so a restart clears it and several workers each keep their own count.
"""
from __future__ import annotations

import math
import threading
import time

from fastapi import HTTPException

MAX_FAILS = 20
WINDOW_S = 600
BLOCK_S = 600

clock = time.monotonic  # replaced in tests
_fails: dict[str, list[float]] = {}
_blocked: dict[str, float] = {}
_lock = threading.Lock()


def _blocked_for(key: str, now: float) -> float:
    until = _blocked.get(key, 0.0)
    if until <= now:
        _blocked.pop(key, None)
        return 0.0
    return until - now


def check(*keys: str) -> None:
    """Raise 429 if any key is currently blocked."""
    now = clock()
    with _lock:
        left = max((_blocked_for(k, now) for k in keys), default=0.0)
    if left > 0:
        minutes = max(1, math.ceil(left / 60))
        raise HTTPException(429, f"Too many wrong attempts. Please try again in {minutes} minute{'s' if minutes != 1 else ''}.",
                            headers={"Retry-After": str(int(left) + 1)})


def fail(*keys: str) -> None:
    """Record a wrong attempt; the MAX_FAILS-th one inside the window starts the block."""
    now = clock()
    with _lock:
        if len(_fails) > 10_000:  # keep memory bounded under a spray of random emails
            for k in [k for k, v in _fails.items() if not v or v[-1] < now - WINDOW_S]:
                _fails.pop(k, None)
        for k in keys:
            hits = [t for t in _fails.get(k, []) if t > now - WINDOW_S] + [now]
            _fails[k] = hits
            if len(hits) >= MAX_FAILS:
                _blocked[k] = now + BLOCK_S
                _fails.pop(k, None)


def clear(*keys: str) -> None:
    with _lock:
        for k in keys:
            _fails.pop(k, None)
            _blocked.pop(k, None)
