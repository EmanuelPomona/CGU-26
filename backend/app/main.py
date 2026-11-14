"""App factory: CORS, the single error shape, router wiring."""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import errors
from app.routers import board, decisions, disruptions, feeds, network, options

LOCAL_ORIGINS = r"^http://(localhost|127\.0\.0\.1)(:\d+)?$"


def create_app() -> FastAPI:
    app = FastAPI(title="Drayline API", version="1.0.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=LOCAL_ORIGINS,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type"],
    )
    errors.install(app)
    for r in (network.router, board.router, disruptions.router, options.router, decisions.router, feeds.router):
        app.include_router(r, prefix="/api")
    return app


app = create_app()
