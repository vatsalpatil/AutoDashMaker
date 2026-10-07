"""AI provider management: catalog, connect/test, model listing and switching."""
import time

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..core.store import store
from ..services import ai as ai_svc, ai_models, audit

router = APIRouter()


class ProviderIn(BaseModel):
    label: str
    provider: str
    model: str
    api_key: str = ""
    base_url: str | None = None
    is_default: bool = False


class ProviderTestIn(BaseModel):
    id: str | None = None
    provider: str | None = None
    model: str | None = None
    api_key: str = ""
    base_url: str | None = None


class ModelIn(BaseModel):
    model: str
    make_default: bool = True


def _make_default(provider_id: str) -> None:
    store.execute("UPDATE ai_providers SET is_default = FALSE")
    store.update("ai_providers", provider_id, {"is_default": True})


def _get_provider(provider_id: str) -> dict:
    row = store.get("ai_providers", provider_id)
    if not row:
        raise HTTPException(404, "provider not found")
    return row


@router.get("/catalog")
def catalog():
    return ai_models.PROVIDER_CATALOG


@router.get("/providers")
def list_providers():
    rows = store.list("ai_providers")
    for r in rows:
        r["api_key"] = ("•••" + r["api_key"][-4:]) if r.get("api_key") else ""
    return rows


@router.post("/providers")
def add_provider(body: ProviderIn):
    if body.is_default:
        store.execute("UPDATE ai_providers SET is_default = FALSE")
    return store.insert("ai_providers", body.model_dump())


@router.post("/providers/test")
def test_provider(body: ProviderTestIn):
    if body.id:  # saved provider: use the stored, unmasked key
        return ai_svc.test_provider(_get_provider(body.id))
    if not body.provider or not body.model:  # unsaved credentials from the "Add provider" form
        raise HTTPException(422, "provider and model are required to test credentials")
    return ai_svc.test_provider(body.model_dump(include={"provider", "model", "api_key", "base_url"}))


@router.get("/models")
def list_models(provider: str | None = None, provider_id: str | None = None):
    """Live model list for a connected provider (uses its stored key) or, keyless, a provider type."""
    if provider_id:
        cfg = _get_provider(provider_id)
    elif provider:
        cfg = {"provider": provider, "api_key": "", "base_url": None}
    else:
        raise HTTPException(422, "provider or provider_id required")
    return ai_models.list_models(cfg)


@router.post("/providers/{provider_id}/stats")
def provider_stats(provider_id: str):
    """Test a connected provider end-to-end and report round-trip latency plus how many models it offers."""
    row = _get_provider(provider_id)
    t0 = time.perf_counter()
    res = ai_svc.test_provider(row)
    latency = round((time.perf_counter() - t0) * 1000)
    listing = ai_models.list_models(row)
    models = listing["models"]
    return {
        "ok": res.get("ok", True) is not False,
        "detail": res.get("detail"),
        "latency_ms": latency,
        "model_count": len(models),
        "free_count": sum(1 for m in models if m.get("free")),
        "models_source": listing["source"],
        "models_error": listing.get("error"),
        "active_model": row.get("model"),
    }


@router.post("/providers/{provider_id}/model")
def set_model(provider_id: str, body: ModelIn):
    """Switch the model used by a connected provider (and optionally make it the active one)."""
    row = _get_provider(provider_id)
    patch = {"model": body.model}
    if row.get("label") == f"{row['provider']} ({row.get('model')})":  # auto-generated label follows the model
        patch["label"] = f"{row['provider']} ({body.model})"
    store.update("ai_providers", provider_id, patch)
    if body.make_default:
        _make_default(provider_id)
    audit.record("ai.model", entity_type="provider", entity_id=provider_id, detail=f"{row['provider']} -> {body.model}")
    return {"ok": True}


@router.delete("/providers/{provider_id}")
def delete_provider(provider_id: str):
    store.delete("ai_providers", provider_id)
    return {"ok": True}


@router.post("/providers/{provider_id}/default")
def set_default(provider_id: str):
    _make_default(provider_id)
    return {"ok": True}
