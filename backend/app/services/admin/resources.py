"""Live host + process resources for the backoffice monitor, read from /proc (Linux server; other OSes return None).

`sample()` is cheap and remembers the previous CPU/network reading, so CPU % and network rates are deltas between
two calls; it also keeps the last HISTORY samples in memory for the live charts.
"""
from __future__ import annotations

import collections
import os
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

HISTORY = 240
_history: collections.deque = collections.deque(maxlen=HISTORY)
_prev: dict = {}
_lock = threading.Lock()


def _read(path: str) -> str | None:
    try:
        return Path(path).read_text()
    except OSError:
        return None


def _cpu_times() -> tuple[int, int] | None:
    txt = _read("/proc/stat")
    if not txt:
        return None
    v = [int(x) for x in txt.splitlines()[0].split()[1:]]
    return sum(v), v[3] + (v[4] if len(v) > 4 else 0)  # total, idle+iowait


def _meminfo() -> dict:
    txt = _read("/proc/meminfo") or ""
    m = {ln.split(":")[0]: int(ln.split()[1]) * 1024 for ln in txt.splitlines() if ln.split()[1:]}
    if not m:
        return {"total": None, "available": None, "used": None, "swap_total": None, "swap_used": None}
    return {"total": m.get("MemTotal"), "available": m.get("MemAvailable"), "used": m.get("MemTotal", 0) - m.get("MemAvailable", 0),
            "swap_total": m.get("SwapTotal"), "swap_used": m.get("SwapTotal", 0) - m.get("SwapFree", 0)}


def _proc() -> dict:
    status = _read("/proc/self/status") or ""
    f = {ln.split(":")[0]: ln.split()[1] for ln in status.splitlines() if ln.split()[1:]}
    fds = len(os.listdir("/proc/self/fd")) if os.path.isdir("/proc/self/fd") else None
    return {"rss": int(f["VmRSS"]) * 1024 if "VmRSS" in f else None, "threads": int(f.get("Threads", threading.active_count())),
            "open_files": fds, "pid": os.getpid()}


def _net() -> tuple[int, int] | None:
    txt = _read("/proc/net/dev")
    if not txt:
        return None
    rx = tx = 0
    for ln in txt.splitlines()[2:]:
        name, data = ln.split(":", 1)
        if name.strip() == "lo":
            continue
        v = data.split()
        rx, tx = rx + int(v[0]), tx + int(v[8])
    return rx, tx


def sample() -> dict:
    now, cpu, net = time.time(), _cpu_times(), _net()
    with _lock:
        prev = dict(_prev)
        _prev.update(t=now, cpu=cpu, net=net)
    cpu_pct = rx_rate = tx_rate = None
    if cpu and prev.get("cpu"):
        dt, di = cpu[0] - prev["cpu"][0], cpu[1] - prev["cpu"][1]
        cpu_pct = round(100 * (1 - di / dt), 1) if dt > 0 else None
    if net and prev.get("net") and now > prev["t"]:
        rx_rate = round((net[0] - prev["net"][0]) / (now - prev["t"]))
        tx_rate = round((net[1] - prev["net"][1]) / (now - prev["t"]))
    mem, proc = _meminfo(), _proc()
    load = os.getloadavg() if hasattr(os, "getloadavg") else None
    snap = {"at": datetime.now(timezone.utc).isoformat(), "cpu_pct": cpu_pct, "cpus": os.cpu_count(), "load": load,
            "mem": mem, "process": proc, "net": {"rx_total": net[0] if net else None, "tx_total": net[1] if net else None,
                                                  "rx_rate": rx_rate, "tx_rate": tx_rate}}
    mem_pct = round(100 * mem["used"] / mem["total"], 1) if mem.get("total") else None
    with _lock:
        if not _history or now - _history[-1]["t"] >= 2:
            _history.append({"t": now, "time": snap["at"][11:19], "cpu": cpu_pct, "mem": mem_pct,
                             "rss_mb": round(proc["rss"] / 2**20, 1) if proc["rss"] else None,
                             "rx_kb": round(rx_rate / 1024, 1) if rx_rate is not None else None,
                             "tx_kb": round(tx_rate / 1024, 1) if tx_rate is not None else None})
        snap["history"] = [{k: v for k, v in h.items() if k != "t"} for h in _history]
    return snap
