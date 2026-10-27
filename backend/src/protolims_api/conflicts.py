"""Clear replies when a change would break a "unique within the study" rule."""

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError

# The database names these rules uq_<table>_study_id_external_id.
EXTERNAL_ID_CONSTRAINT_SUFFIX = "_study_id_external_id"


def is_external_id_conflict(exc: IntegrityError) -> bool:
    """Whether an error came from two records in a study sharing an external ID."""
    diagnostics = getattr(exc.orig, "diag", None)
    constraint = str(getattr(diagnostics, "constraint_name", None) or "")
    return constraint.endswith(EXTERNAL_ID_CONSTRAINT_SUFFIX)


def external_id_conflict(kind: str, external_id: str | None, where: str) -> HTTPException:
    """A 409 reply saying the external ID is already used.

    It starts "External ID", so the website can tell it apart from a duplicate name.
    """
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail=f"External ID {external_id!r} is already used by another {kind} {where}",
    )
