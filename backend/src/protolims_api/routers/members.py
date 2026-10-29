"""Who has which role on a project or study, and changing it.

People are named by ORCID iD. Someone who hasn't signed in yet can be given a role in
advance; it's waiting for them when they first sign in. Only admins can see or change roles:
a project's admins (and site administrators) for the project and its studies, and a study's
admins for that study.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Path, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from protolims_api.audit import record_event
from protolims_api.db import SessionDep
from protolims_api.models import AppUser, ProjectMember, StudyMember
from protolims_api.orcid import OrcidId
from protolims_api.permissions import Actor, ActorDep, project_role, require, study_role
from protolims_api.routers.projects import get_project_or_404
from protolims_api.routers.studies import get_study_or_404
from protolims_api.schemas.user import MemberRead, MemberRole, UserRead

router = APIRouter(tags=["members"])

OrcidPath = Annotated[OrcidId, Path(description="Their ORCID iD, e.g. 0000-0002-1825-0097")]


async def find_user(session: AsyncSession, orcid_id: str) -> AppUser | None:
    return await session.scalar(
        select(AppUser).where(AppUser.provider == "orcid", AppUser.subject == orcid_id)
    )


async def find_or_add_user(session: AsyncSession, orcid_id: str) -> AppUser:
    """The person with this ORCID iD, added (without a name) if they haven't signed in yet."""
    user = await find_user(session, orcid_id)
    if user is None:
        user = AppUser(provider="orcid", subject=orcid_id)
        session.add(user)
        await session.flush()
    return user


def member_read(user: AppUser, role: str) -> MemberRead:
    return MemberRead.model_validate({"user": UserRead.model_validate(user), "role": role})


async def record_change(
    session: AsyncSession,
    actor: Actor,
    *,
    action: str,
    entity_type: str,
    entity_id: uuid.UUID,
    orcid_id: str,
    before: str | None,
    after: str | None,
) -> None:
    await record_event(
        session,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        actor=actor.label,
        changes={
            "before": {"orcid": orcid_id, "role": before},
            "after": {"orcid": orcid_id, "role": after},
        },
    )


@router.get("/projects/{project_code}/members")
async def list_project_members(
    project_code: str, session: SessionDep, actor: ActorDep
) -> list[MemberRead]:
    """Everyone with a role on the project, by name (people without one last)."""
    project = await get_project_or_404(session, project_code)
    require(actor, await project_role(session, actor, project.id), "admin")
    result = await session.execute(
        select(AppUser, ProjectMember.role)
        .join(ProjectMember, ProjectMember.user_id == AppUser.id)
        .where(ProjectMember.project_id == project.id)
        .order_by(AppUser.name.asc().nulls_last(), AppUser.subject)
    )
    return [member_read(user, role) for user, role in result]


@router.put("/projects/{project_code}/members/{orcid_id}")
async def set_project_member(
    project_code: str,
    orcid_id: OrcidPath,
    payload: MemberRole,
    session: SessionDep,
    actor: ActorDep,
) -> MemberRead:
    """Give someone a role on the project, or change it. Safe to repeat."""
    project = await get_project_or_404(session, project_code)
    require(actor, await project_role(session, actor, project.id), "admin")
    user = await find_or_add_user(session, orcid_id)
    member = await session.get(ProjectMember, (project.id, user.id))
    before = None if member is None else member.role
    if member is None:
        session.add(
            ProjectMember(
                project_id=project.id, user_id=user.id, role=payload.role, created_by=actor.label
            )
        )
    else:
        member.role = payload.role
    if before != payload.role:
        await record_change(
            session,
            actor,
            action="set_member",
            entity_type="project",
            entity_id=project.id,
            orcid_id=orcid_id,
            before=before,
            after=payload.role,
        )
    await session.commit()
    return member_read(user, payload.role)


@router.delete(
    "/projects/{project_code}/members/{orcid_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
async def remove_project_member(
    project_code: str, orcid_id: OrcidPath, session: SessionDep, actor: ActorDep
) -> None:
    """Take away someone's role on the project. Safe to repeat."""
    project = await get_project_or_404(session, project_code)
    require(actor, await project_role(session, actor, project.id), "admin")
    user = await find_user(session, orcid_id)
    member = None if user is None else await session.get(ProjectMember, (project.id, user.id))
    if member is not None:
        await session.delete(member)
        await record_change(
            session,
            actor,
            action="remove_member",
            entity_type="project",
            entity_id=project.id,
            orcid_id=orcid_id,
            before=member.role,
            after=None,
        )
        await session.commit()


@router.get("/projects/{project_code}/studies/{study_code}/members")
async def list_study_members(
    project_code: str, study_code: str, session: SessionDep, actor: ActorDep
) -> list[MemberRead]:
    """Everyone with a role on the study itself (project roles are listed on the project)."""
    study = await get_study_or_404(session, project_code, study_code)
    require(actor, await study_role(session, actor, study.project_id, study.id), "admin")
    result = await session.execute(
        select(AppUser, StudyMember.role)
        .join(StudyMember, StudyMember.user_id == AppUser.id)
        .where(StudyMember.study_id == study.id)
        .order_by(AppUser.name.asc().nulls_last(), AppUser.subject)
    )
    return [member_read(user, role) for user, role in result]


@router.put("/projects/{project_code}/studies/{study_code}/members/{orcid_id}")
async def set_study_member(
    project_code: str,
    study_code: str,
    orcid_id: OrcidPath,
    payload: MemberRole,
    session: SessionDep,
    actor: ActorDep,
) -> MemberRead:
    """Give someone a role on the study, or change it. Safe to repeat."""
    study = await get_study_or_404(session, project_code, study_code)
    require(actor, await study_role(session, actor, study.project_id, study.id), "admin")
    user = await find_or_add_user(session, orcid_id)
    member = await session.get(StudyMember, (study.id, user.id))
    before = None if member is None else member.role
    if member is None:
        session.add(
            StudyMember(
                study_id=study.id, user_id=user.id, role=payload.role, created_by=actor.label
            )
        )
    else:
        member.role = payload.role
    if before != payload.role:
        await record_change(
            session,
            actor,
            action="set_member",
            entity_type="study",
            entity_id=study.id,
            orcid_id=orcid_id,
            before=before,
            after=payload.role,
        )
    await session.commit()
    return member_read(user, payload.role)


@router.delete(
    "/projects/{project_code}/studies/{study_code}/members/{orcid_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
async def remove_study_member(
    project_code: str, study_code: str, orcid_id: OrcidPath, session: SessionDep, actor: ActorDep
) -> None:
    """Take away someone's role on the study. Safe to repeat."""
    study = await get_study_or_404(session, project_code, study_code)
    require(actor, await study_role(session, actor, study.project_id, study.id), "admin")
    user = await find_user(session, orcid_id)
    member = None if user is None else await session.get(StudyMember, (study.id, user.id))
    if member is not None:
        await session.delete(member)
        await record_change(
            session,
            actor,
            action="remove_member",
            entity_type="study",
            entity_id=study.id,
            orcid_id=orcid_id,
            before=member.role,
            after=None,
        )
        await session.commit()
