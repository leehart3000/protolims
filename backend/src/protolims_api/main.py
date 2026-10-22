"""FastAPI application entry point."""

from fastapi import FastAPI, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from protolims_api.db import SessionDep
from protolims_api.routers import projects, studies

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
