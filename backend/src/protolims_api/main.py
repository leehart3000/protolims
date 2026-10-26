"""FastAPI application entry point."""

import secrets

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from starlette.middleware.base import RequestResponseEndpoint

from protolims_api.config import get_settings
from protolims_api.db import SessionDep
from protolims_api.routers import assays, projects, samples, studies, subjects

PROXY_KEY_HEADER = "X-ProtoLIMS-Proxy-Key"

# Health checks stay open, so deploys can check the API directly.
OPEN_PATHS = frozenset({"/health", "/health/db"})

app = FastAPI(
    title="ProtoLIMS API",
    version="0.1.0",
    description="Multi-omics LIMS: sample tracking, provenance, assay metadata and results.",
    docs_url="/api/docs",
    redoc_url=None,
    openapi_url="/api/openapi.json",
)
app.include_router(projects.router, prefix="/api/v1")
app.include_router(studies.router, prefix="/api/v1")
app.include_router(subjects.router, prefix="/api/v1")
app.include_router(samples.router, prefix="/api/v1")
app.include_router(assays.router, prefix="/api/v1")


@app.middleware("http")
async def require_proxy_key(request: Request, call_next: RequestResponseEndpoint) -> Response:
    """When a proxy key is set, refuse requests that didn't come through the website."""
    key = get_settings().proxy_key
    if key is not None and request.url.path not in OPEN_PATHS:
        sent = request.headers.get(PROXY_KEY_HEADER, "")
        if not secrets.compare_digest(sent.encode(), key.get_secret_value().encode()):
            return JSONResponse({"detail": "Forbidden"}, status_code=403)
    return await call_next(request)


@app.get("/health", tags=["system"])
def health() -> dict[str, str]:
    """Report that the API is running."""
    return {"status": "ok"}


@app.get("/health/db", tags=["system"])
async def health_db(session: SessionDep) -> dict[str, str]:
    """Report whether the API can reach the database."""
    try:
        await session.execute(text("select 1"))
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="Database unavailable") from exc
    return {"status": "ok", "database": "ok"}
