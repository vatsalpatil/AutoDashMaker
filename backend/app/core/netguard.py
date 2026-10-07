"""Outbound-network and filesystem confinement for multi-user (auth-enabled) servers.

Local single-user mode (AUTH_ENABLED=false) is unchanged: people may point sources at localhost or any file on their PC.
With auth on, every user is untrusted: they may only reach public internet hosts, and only read their own upload folder.
"""
from __future__ import annotations

import ipaddress
import socket
from pathlib import Path
from urllib.parse import urlsplit

import httpx

from . import tenant
from .config import settings


class NetworkBlocked(Exception):
    pass


def _bad(ip: ipaddress._BaseAddress) -> bool:
    return (ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast
            or ip.is_unspecified or ip.is_reserved)


def ensure_public_host(host: str) -> None:
    """Refuse hosts that are (or resolve to) private / loopback / link-local addresses. No-op in local mode."""
    if not settings.auth_enabled:
        return
    if not host:
        raise NetworkBlocked("missing host")
    try:
        addrs = {ipaddress.ip_address(host.strip("[]"))}
    except ValueError:
        try:
            addrs = {ipaddress.ip_address(i[4][0]) for i in socket.getaddrinfo(host, None)}
        except OSError as e:
            raise NetworkBlocked(f"cannot resolve host {host}") from e
    if any(_bad(a) for a in addrs):
        raise NetworkBlocked("connections to internal or private addresses are not allowed")


def ensure_public_url(url: str) -> None:
    parts = urlsplit(url.strip())
    if parts.scheme not in ("http", "https") or not parts.hostname:
        raise NetworkBlocked("only http:// and https:// URLs are supported")
    ensure_public_host(parts.hostname)


def safe_client(**kwargs) -> httpx.Client:
    """httpx client that re-checks every request, redirects included. Plain client in local mode."""
    if settings.auth_enabled:
        kwargs.setdefault("event_hooks", {"request": [lambda r: ensure_public_url(str(r.url))]})
    return httpx.Client(**kwargs)


def confine_path(path: str | Path) -> Path:
    """With auth on, a source file must live inside the caller's own upload folder (never another user's, never the server's)."""
    p = Path(str(path))
    if not settings.auth_enabled:
        return p
    root = tenant.upload_dir().resolve()
    rp = p.resolve()
    if root not in rp.parents:
        raise NetworkBlocked("files must be uploaded through the app; arbitrary server paths are not allowed")
    return rp
