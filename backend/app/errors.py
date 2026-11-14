"""The single error shape: {"error": code, "message": text, "field"?: name}."""
from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

log = logging.getLogger("drayline")


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str, field: str | None = None):
        super().__init__(message)
        self.status, self.code, self.message, self.field = status, code, message, field


def validation(message: str, field: str) -> ApiError:
    return ApiError(422, "validation_error", message, field)


def not_found(what: str, ident: str) -> ApiError:
    return ApiError(404, "not_found", f"No {what} with id {ident!r}.")


def body(code: str, message: str, field: str | None = None) -> dict:
    out = {"error": code, "message": message}
    if field:
        out["field"] = field
    return out


def _field_from_loc(loc) -> str:
    parts = [str(p) for p in loc if p not in ("body", "query", "path")]
    return ".".join(parts) if parts else "body"


def install(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def _api(_: Request, exc: ApiError):
        return JSONResponse(body(exc.code, exc.message, exc.field), status_code=exc.status)

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError):
        errs = exc.errors()
        first = errs[0] if errs else {"loc": ("body",), "msg": "Invalid request body."}
        if first.get("type") == "json_invalid":
            return JSONResponse(body("validation_error", "Request body is not valid JSON.", "body"), status_code=422)
        field = _field_from_loc(first.get("loc", ()))
        msg = f"{field}: {first.get('msg', 'invalid value')}"
        return JSONResponse(body("validation_error", msg, field), status_code=422)

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException):
        if exc.status_code == 404:
            return JSONResponse(body("not_found", "No such resource."), status_code=404)
        if exc.status_code == 405:
            return JSONResponse(body("not_found", "Method not allowed on this path."), status_code=405)
        log.warning("http error %s: %s", exc.status_code, exc.detail)
        return JSONResponse(body("internal_error", "Request could not be handled."), status_code=exc.status_code)

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception):
        log.exception("unhandled error", exc_info=exc)
        return JSONResponse(body("internal_error", "An unexpected error occurred."), status_code=500)
