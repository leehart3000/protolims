"""Everyone who has signed in, or been added by their ORCID iD: for site administrators."""

from typing import Annotated, Any, Literal

from fastapi import APIRouter, Query
from sqlalchemy import ColumnElement, func, or_, select
from sqlalchemy.orm import InstrumentedAttribute

from protolims_api.config import get_settings
from protolims_api.db import SessionDep
from protolims_api.models import AppUser
from protolims_api.permissions import ActorDep, require_site_admin
from protolims_api.roles import roles_of_users
from protolims_api.schemas.common import Page
from protolims_api.schemas.user import UserRead, UserSummary

router = APIRouter(tags=["users"])

UserSort = Literal[
    "name", "-name", "last_signed_in_at", "-last_signed_in_at", "created_at", "-created_at"
]

# What each sort key orders by. A leading "-" reverses the order.
USER_SORT_COLUMNS: dict[str, InstrumentedAttribute[Any]] = {
    "name": AppUser.name,
    "last_signed_in_at": AppUser.last_signed_in_at,
    "created_at": AppUser.created_at,
}


@router.get("/users")
async def list_users(
    session: SessionDep,
    actor: ActorDep,
    q: Annotated[
        str | None,
        Query(max_length=200, description="Search names and ORCID iDs, ignoring case"),
    ] = None,
    sort: Annotated[
        UserSort, Query(description="The column to sort by; a leading - reverses the order")
    ] = "name",
    limit: Annotated[int, Query(ge=1, le=500)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> Page[UserSummary]:
    """List everyone a page at a time, with their roles, and the total number that match.
    People without a name (or who haven't signed in) come last. Only site administrators can.
    """
    require_site_admin(actor)
    conditions: list[ColumnElement[bool]] = []
    if q:
        conditions.append(
            or_(
                AppUser.name.icontains(q, autoescape=True),
                AppUser.subject.icontains(q, autoescape=True),
            )
        )
    count_query = select(func.count()).select_from(AppUser).where(*conditions)
    total = (await session.execute(count_query)).scalar_one()

    column = USER_SORT_COLUMNS[sort.removeprefix("-")]
    order = column.desc() if sort.startswith("-") else column.asc()
    users = list(
        await session.scalars(
            select(AppUser)
            .where(*conditions)
            .order_by(order.nulls_last(), AppUser.subject)
            .limit(limit)
            .offset(offset)
        )
    )
    roles = await roles_of_users(session, [user.id for user in users])
    site_admins = get_settings().site_admins
    return Page[UserSummary](
        items=[
            UserSummary(
                **UserRead.model_validate(user).model_dump(),
                created_at=user.created_at,
                last_signed_in_at=user.last_signed_in_at,
                site_admin=user.provider == "orcid" and user.subject in site_admins,
                roles=roles[user.id],
            )
            for user in users
        ],
        total=total,
    )
