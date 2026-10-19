"""FastAPI application entry point."""

from fastapi import FastAPI

app = FastAPI(
    title="ProtoLIMS API",
    version="0.1.0",
    description="Multi-omics LIMS: sample tracking, provenance, assay metadata and results.",
)


@app.get("/health", tags=["system"])
def health() -> dict[str, str]:
    """Report that the API is running."""
    return {"status": "ok"}