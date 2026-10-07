"""Provider model catalog + live model lists (cached). Split from ai.py to keep each module small."""
from __future__ import annotations

from typing import Any

import httpx

from .ai import AIError

# ------------------------------------------------------------ live model lists

_MODELS_TTL_S = 600
_models_cache: dict[tuple, tuple[float, list[dict[str, Any]]]] = {}


def _price(v: Any) -> float | None:
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _fetch_models(kind: str, api_key: str, base_url: str | None) -> list[dict[str, Any]]:
    """Ask the provider itself which models exist: [{id, name, free, context, price_in, price_out}]."""
    if kind == "openrouter":  # public endpoint, no key needed; $/token prices as strings
        resp = httpx.get("https://openrouter.ai/api/v1/models", timeout=20)
        resp.raise_for_status()
        out = [{"id": "openrouter/free", "name": "Free Models Router (auto-picks a free model)",
                "free": True, "context": None, "price_in": 0.0, "price_out": 0.0}]
        for m in resp.json().get("data", []):
            p_in, p_out = _price((m.get("pricing") or {}).get("prompt")), _price((m.get("pricing") or {}).get("completion"))
            out.append({"id": m["id"], "name": m.get("name") or m["id"],
                        "free": m["id"].endswith(":free") or (p_in == 0 and p_out == 0),
                        "context": m.get("context_length"),
                        "price_in": None if p_in is None else p_in * 1e6,    # per 1M tokens
                        "price_out": None if p_out is None else p_out * 1e6})
        return out
    if kind == "anthropic":
        resp = httpx.get("https://api.anthropic.com/v1/models?limit=100", timeout=20,
                         headers={"x-api-key": api_key, "anthropic-version": "2023-06-01"})
        resp.raise_for_status()
        return [{"id": m["id"], "name": m.get("display_name") or m["id"], "free": False}
                for m in resp.json().get("data", [])]
    if kind == "gemini":
        resp = httpx.get("https://generativelanguage.googleapis.com/v1beta/models",
                         params={"key": api_key, "pageSize": 200}, timeout=20)
        resp.raise_for_status()
        return [{"id": m["name"].removeprefix("models/"), "name": m.get("displayName") or m["name"],
                 "free": True, "context": m.get("inputTokenLimit")}
                for m in resp.json().get("models", [])
                if "generateContent" in m.get("supportedGenerationMethods", [])]
    if kind == "ollama":
        root = (base_url or "http://localhost:11434/v1").rstrip("/").removesuffix("/v1")
        resp = httpx.get(f"{root}/api/tags", timeout=5)
        resp.raise_for_status()
        return [{"id": m["name"], "name": m["name"], "free": True} for m in resp.json().get("models", [])]
    # OpenAI-compatible (openai, groq, custom): GET {base}/models
    base = base_url or OPENAI_COMPATIBLE_DEFAULTS.get(kind)
    if not base:
        raise AIError(f"unknown provider: {kind}")
    resp = httpx.get(f"{base.rstrip('/')}/models", headers={"Authorization": f"Bearer {api_key or 'none'}"}, timeout=20)
    resp.raise_for_status()
    free = bool(next((c["free"] for c in PROVIDER_CATALOG if c["id"] == kind), False))
    return [{"id": m["id"], "name": m["id"], "free": free} for m in resp.json().get("data", [])]


def list_models(cfg: dict[str, Any]) -> dict[str, Any]:
    """Models available to this provider/key. Cached 10 min; falls back to the built-in shortlist on failure."""
    import hashlib
    import time
    from ..core.security import redact_secrets

    kind, key, base = cfg["provider"], cfg.get("api_key") or "", cfg.get("base_url")
    ck = (kind, base, hashlib.sha256(key.encode()).hexdigest()[:12])
    hit = _models_cache.get(ck)
    if hit and time.monotonic() - hit[0] < _MODELS_TTL_S:
        return {"models": hit[1], "source": "live"}
    entry = next((c for c in PROVIDER_CATALOG if c["id"] == kind), {})
    try:
        models = _fetch_models(kind, key, base)
        if not models:
            raise AIError("provider returned no models")
    except Exception as e:
        return {"models": [{"id": m, "name": m, "free": bool(entry.get("free"))} for m in entry.get("models", [])],
                "source": "fallback", "error": redact_secrets(str(e))[:200]}
    _models_cache[ck] = (time.monotonic(), models)
    return {"models": models, "source": "live"}


PROVIDER_CATALOG = [
    {"id": "gemini", "label": "Google Gemini", "free": True,
     "models": ["gemini-2.0-flash", "gemini-2.0-flash-lite"],
     "note": "Free tier via Google AI Studio key — default"},
    {"id": "openai", "label": "OpenAI", "free": False,
     "models": ["gpt-4o-mini", "gpt-4o"]},
    {"id": "anthropic", "label": "Anthropic", "free": False,
     "models": ["claude-sonnet-4-5", "claude-haiku-4-5"]},
    {"id": "groq", "label": "Groq", "free": True,
     "models": ["llama-3.3-70b-versatile"], "note": "Free tier, very fast"},
    {"id": "openrouter", "label": "OpenRouter", "free": True,
     "models": ["openrouter/free"], "note": "Free models with :free suffix"},
    {"id": "ollama", "label": "Ollama (local)", "free": True,
     "models": ["llama3.1", "qwen2.5"], "note": "No key needed, runs locally"},
]
