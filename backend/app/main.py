from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import router
from app.config import settings
from app.database.repository import PostgresRepository


@asynccontextmanager
async def lifespan(app: FastAPI):
    if getattr(app.state, "repo", None) is None:
        app.state.repo = PostgresRepository(settings.database_url)
    app.state.tasks = set()
    if settings.database_url:
        await app.state.repo.connect()
    try:
        yield
    finally:
        for task in list(app.state.tasks): task.cancel()
        repo = app.state.repo
        if hasattr(repo, "close"): await repo.close()


def create_app(repo=None) -> FastAPI:
    app = FastAPI(title="Cynbit AI Proposal & Requirements Analyzer", version="0.1.0", lifespan=lifespan)
    app.state.repo = repo or PostgresRepository(settings.database_url)
    app.state.tasks = set()
    app.add_middleware(CORSMiddleware, allow_origins=list(settings.cors_origins), allow_credentials=True, allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"], allow_headers=["Content-Type", "X-CSRF-Token"])
    @app.exception_handler(RuntimeError)
    async def runtime_error_handler(request: Request, exc: RuntimeError):
        return JSONResponse(status_code=503, content={"detail": str(exc)})
    # FastAPI's public include_router API is preferred, but the sandbox's
    # Starlette build represents included routers as a non-dispatching wrapper.
    # Registering the already-built APIRoute objects keeps this app runnable on
    # both framework combinations without changing route behavior.
    app.router.routes.extend(router.routes)
    return app


app = create_app()
