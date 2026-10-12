"""Guard for custom AI provider addresses on a multi-user server.

A provider's base URL is fetched by the SERVER, so a signed-in user could otherwise point it at an internal service (the database, the
auth server, Ollama's admin API...) and read the answers back. In hosted mode a custom URL must therefore be a public host, except hosts
the administrator lists in ALLOWED_AI_HOSTS (for example the self-hosted Ollama service). Built-in provider URLs are not checked, and
local mode has no restriction.
"""
from __future__ import annotations

from urllib.parse import urlparse

from ..core.config import settings
from ..core.netguard import NetworkBlocked, ensure_public_host


def allowed_hosts() -> set[str]:
    return {h.strip().lower() for h in settings.allowed_ai_hosts.split(",") if h.strip()}


def check_provider_url(kind: str, base_url: str | None, defaults: dict[str, str]) -> None:
    """Raise ValueError (a sentence for the user) when a custom URL points somewhere a hosted user must not reach."""
    if not settings.auth_enabled or kind in ("anthropic", "gemini") or not base_url or base_url == defaults.get(kind):
        return
    host = (urlparse(base_url).hostname or "").lower()
    if host in allowed_hosts():
        return
    try:
        ensure_public_host(host)
    except NetworkBlocked as e:
        raise ValueError(f"That AI address is not allowed on this server ({e}). Use a public https address"
                         + (f", or one of: {', '.join(sorted(allowed_hosts()))}" if allowed_hosts() else "") + ".") from None
