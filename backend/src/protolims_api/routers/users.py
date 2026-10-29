"""Everyone who has signed in, or been added by their ORCID iD: for site administrators."""

from typing import Annotated, Any, Literal

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import ColumnElement, func, or_, select
from sqlalchemy.orm import InstrumentedAttribute

from protolims_api.audit import record_event
from protolims_api.config import get_settings
from protolims_api.db import SessionDep
from protolims_api.models import AppUser
from protolims_api.permissions import ActorDep, require_site_admin
from protolims_api.roles import roles_of_users
from protolims_api.routers.members import OrcidPath, find_user
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


@router.delete("/users/{orcid_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_user(orcid_id: OrcidPath, session: SessionDep, actor: ActorDep) -> None:
    """Remove someone from the list of users. Only site administrators can, and only for someone
    with no roles who isn't a site administrator, so nobody loses access this way: remove their
    roles first. Any sessions they have end. Records that name them keep their ORCID iD, and if
    they sign in again, they're added back with no roles.
    """
    require_site_admin(actor)
    user = await find_user(session, orcid_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No user with ORCID iD {orcid_id}")
    if orcid_id in get_settings().site_admins:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Site administrators can't be removed: they're set in the server's settings.",
        )
    if (await roles_of_users(session, [user.id]))[user.id]:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This person still has roles. Remove their roles first.",
        )
    await record_event(
        session,
        action="remove_user",
        entity_type="user",
        entity_id=user.id,
        actor=actor.label,
        changes={"before": {"orcid": orcid_id, "name": user.name}},
    )
    await session.delete(user)
    await session.commit()
