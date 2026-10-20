"""FastAPI application entry point."""

from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from protolims_api.db import get_session

app = FastAPI(
    title="ProtoLIMS API",
    version="0.1.0",
    description="Multi-omics LIMS: sample tracking, provenance, assay metadata and results.",
)


@app.get("/health", tags=["system"])
def health() -> dict[str, str]:
    """Report that the API is running."""
    return {"status": "ok"}


@app.get("/health/db", tags=["system"])
async def health_db(session: Annotated[AsyncSession, Depends(get_session)]) -> dict[str, str]:
    """Report whether the API can reach the database."""
    try:
        await session.execute(text("select 1"))
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="Database unavailable") from exc
    return {"status": "ok", "database": "ok"}
