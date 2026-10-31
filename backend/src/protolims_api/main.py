"""FastAPI application entry point."""

import secrets

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from starlette.middleware.base import RequestResponseEndpoint

from protolims_api.config import get_settings
from protolims_api.db import SessionDep
from protolims_api.permissions import require_sign_in_when_private
from protolims_api.read_only import READ_ONLY_MESSAGE, allowed_while_read_only
from protolims_api.routers import (
    assays,
    auth,
    data_files,
    importing,
    members,
    projects,
    samples,
    studies,
    subjects,
    tokens,
    users,
)

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

# Signing in is always open. Everything else needs someone signed in when public reading is off.
private = [Depends(require_sign_in_when_private)]
app.include_router(projects.router, prefix="/api/v1", dependencies=private)
app.include_router(studies.router, prefix="/api/v1", dependencies=private)
app.include_router(subjects.router, prefix="/api/v1", dependencies=private)
app.include_router(samples.router, prefix="/api/v1", dependencies=private)
app.include_router(assays.router, prefix="/api/v1", dependencies=private)
app.include_router(data_files.router, prefix="/api/v1", dependencies=private)
app.include_router(importing.router, prefix="/api/v1", dependencies=private)
app.include_router(auth.router, prefix="/api/v1")
app.include_router(tokens.router, prefix="/api/v1")
app.include_router(members.router, prefix="/api/v1", dependencies=private)
app.include_router(users.router, prefix="/api/v1", dependencies=private)


@app.middleware("http")
async def refuse_changes_when_read_only(
    request: Request, call_next: RequestResponseEndpoint
) -> Response:
    """When the site is read-only, refuse anything that would change something."""
    if get_settings().read_only and not allowed_while_read_only(request.method, request.url.path):
        return JSONResponse({"detail": READ_ONLY_MESSAGE}, status_code=423)
    return await call_next(request)


# Added last, so it runs first: requests without the proxy key never get further.
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
