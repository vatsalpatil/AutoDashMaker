"""One error shape for every API failure: {"detail": plain message, "code": stable id, "hint"?: what to do}.

    raise AppError(409, "Dataset limit reached (20 per account).", code="quota.datasets", hint="Delete one, or ask an admin.")

`detail` stays a plain string (every existing client reads it); `code` lets the UI react without parsing English
(e.g. show an upgrade/cleanup prompt for `quota.*`). Plain HTTPExceptions get a code from their status, and request
validation errors name the field ("threshold: must be a number") instead of FastAPI's bare "Field required".
"""
from __future__ import annotations

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

_BY_STATUS = {400: "bad_request", 401: "auth.required", 403: "forbidden", 404: "not_found", 409: "conflict",
              413: "too_large", 422: "invalid_input", 429: "rate_limited", 500: "server_error", 503: "unavailable"}


class AppError(HTTPException):
    def __init__(self, status: int, message: str, *, code: str | None = None, hint: str | None = None):
        super().__init__(status, message)
        self.code, self.hint = code or _BY_STATUS.get(status, "error"), hint


def _body(detail, code: str, hint: str | None = None) -> dict:
    return {"detail": detail, "code": code, **({"hint": hint} if hint else {})}


def install(app: FastAPI) -> None:
    @app.exception_handler(HTTPException)
    async def _http(_: Request, e: HTTPException):
        code = getattr(e, "code", None) or _BY_STATUS.get(e.status_code, "error")
        return JSONResponse(_body(e.detail, code, getattr(e, "hint", None)), status_code=e.status_code, headers=e.headers)

    @app.exception_handler(RequestValidationError)
    async def _invalid(_: Request, e: RequestValidationError):
        parts = []
        for err in e.errors()[:5]:
            field = ".".join(str(p) for p in err.get("loc", ()) if p not in ("body", "query", "path"))
            parts.append(f"{field}: {err.get('msg', 'invalid')}" if field else err.get("msg", "invalid"))
        return JSONResponse(_body("; ".join(parts) or "invalid input", "invalid_input"), status_code=422)
