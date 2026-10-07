"""API Studio: send requests through the server, and turn JSON records into datasets."""
import json
import re
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..connectors import ConnectorError
from ..connectors.rest import flatten
from ..core.config import settings
from ..core.store import store
from ..services import audit
from ..services import ai as ai_svc
from ..services.http_proxy import ProxyError, check_url, fetch_pages, send
from ..services.ingest import ingest_source
from ..core import tenant

router = APIRouter(prefix="/api/studio", tags=["studio"])


class RequestIn(BaseModel):
    method: str = "GET"
    url: str
    headers: dict[str, str] = {}
    params: dict[str, str] = {}
    body: str | None = None
    timeout: float = 30


@router.post("/request")
def request(body: RequestIn):
    """Run an HTTP request on the server (no CORS limits) and return status, timing, headers and the body text."""
    try:
        out = send(body.method, body.url, body.headers, body.body, body.params, min(max(body.timeout, 1), 120))
    except ProxyError as e:
        raise HTTPException(400, str(e))
    audit.record("studio.request", detail=f"{body.method.upper()} {body.url[:200]} -> {out['status']}", duration_ms=out["elapsed_ms"])
    return out


class RecordsIn(BaseModel):
    name: str
    records: list[dict[str, Any]]
    separator: str = "_"        # flattened column names: version_name (SQL-friendly) or version.name


@router.post("/records-to-dataset")
def records_to_dataset(body: RecordsIn):
    """Flatten JSON records and register them as a dataset (a small JSON file + a file source behind it)."""
    if not body.records:
        raise HTTPException(400, "no records to import")
    rows = [flatten(r, body.separator) for r in body.records]
    stem = re.sub(r"[^A-Za-z0-9_-]+", "_", body.name.strip()).strip("_") or "records"
    dest = tenant.upload_dir() / f"{stem}_{uuid.uuid4().hex[:6]}.json"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(rows), encoding="utf-8")
    src = store.insert("datasources", {"name": dest.name, "type": "file", "config": {"path": str(dest)}})
    try:
        ds = ingest_source(src, stem)
    except ConnectorError as e:
        raise HTTPException(400, str(e))
    audit.record("studio.dataset", entity_type="dataset", entity_id=ds["id"], detail=f"{stem} ({len(rows)} records)")
    return ds


class PagesIn(RequestIn):
    next_path: str | None = None   # JSON path of the next-page URL (default `next`); a Link header is always honoured
    page_param: str | None = None  # query parameter to count up (page=1,2,…) when there is no next link
    max_pages: int = 20


@router.post("/pages")
def pages(body: PagesIn):
    """Fetch every page of a paginated API and return the merged records."""
    try:
        out = fetch_pages(body.method, body.url, body.headers, body.body, body.params, body.next_path, body.page_param,
                          min(max(body.max_pages, 1), 100))
    except ProxyError as e:
        raise HTTPException(400, str(e))
    audit.record("studio.pages", detail=f"{body.url[:200]} -> {out['pages']} pages, {len(out['records'])} records", duration_ms=out["elapsed_ms"])
    return out


class ExplainIn(BaseModel):
    method: str = "GET"
    url: str = ""
    status: int = 200
    body: str


@router.post("/explain")
def explain(body: ExplainIn):
    """Plain-language explanation of an API response: what it contains, notable fields, anything that looks wrong."""
    sample = body.body[:6000]
    msgs = [
        {"role": "system", "content": "You explain API responses to analysts in at most 6 short bullet points: what the "
         "response is, how the records are structured, which fields look useful for analysis, and anything odd "
         "(errors, nulls, pagination hints). No preamble."},
        {"role": "user", "content": f"{body.method} {body.url} returned HTTP {body.status}:\n{sample}"},
    ]
    try:
        text = ai_svc.chat(msgs, max_tokens=800)
    except ai_svc.AIError as e:
        raise HTTPException(400, str(e))
    return {"explanation": ai_svc._THINK.sub("", text).strip()}


class StreamIn(BaseModel):
    url: str
    headers: dict[str, str] = {}
    seconds: float = 60


@router.post("/stream")
def stream(body: StreamIn):
    """Relay a Server-Sent-Events (or any streaming text) endpoint to the browser; stops after `seconds`."""
    import time
    import httpx
    from fastapi.responses import StreamingResponse
    try:
        url = check_url(body.url)
    except ProxyError as e:
        raise HTTPException(400, str(e))
    limit = min(max(body.seconds, 5), 300)

    def gen():
        t0 = time.monotonic()
        try:
            with httpx.Client(timeout=httpx.Timeout(limit, connect=15)) as client:
                with client.stream("GET", url, headers={"Accept": "text/event-stream", **body.headers}) as resp:
                    if resp.status_code >= 400:
                        yield f"event: error\ndata: HTTP {resp.status_code}\n\n".encode()
                        return
                    for chunk in resp.iter_bytes():
                        yield chunk
                        if time.monotonic() - t0 > limit:
                            break
        except httpx.HTTPError as e:
            yield f"event: error\ndata: {str(e) or type(e).__name__}\n\n".encode()

    return StreamingResponse(gen(), media_type="text/event-stream")
