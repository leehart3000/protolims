"""Looking up people's roles, to show them."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from protolims_api.models import Project, ProjectMember, Study, StudyMember
from protolims_api.schemas.user import RoleRead


async def roles_of_users(
    session: AsyncSession, user_ids: list[uuid.UUID]
) -> dict[uuid.UUID, list[RoleRead]]:
    """Each person's roles: on projects, then on studies, each in order of their codes."""
    roles: dict[uuid.UUID, list[RoleRead]] = {user_id: [] for user_id in user_ids}
    on_projects = await session.execute(
        select(ProjectMember.user_id, Project.code, ProjectMember.role)
        .join(ProjectMember, ProjectMember.project_id == Project.id)
        .where(ProjectMember.user_id.in_(user_ids))
        .order_by(Project.code)
    )
    for user_id, project, role in on_projects:
        roles[user_id].append(
            RoleRead.model_validate({"project": project, "study": None, "role": role})
        )
    on_studies = await session.execute(
        select(StudyMember.user_id, Project.code, Study.code, StudyMember.role)
        .join(Study, Study.project_id == Project.id)
        .join(StudyMember, StudyMember.study_id == Study.id)
        .where(StudyMember.user_id.in_(user_ids))
        .order_by(Project.code, Study.code)
    )
    for user_id, project, study, role in on_studies:
        roles[user_id].append(
            RoleRead.model_validate({"project": project, "study": study, "role": role})
        )
    return roles
