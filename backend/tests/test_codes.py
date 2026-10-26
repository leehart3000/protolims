"""Tests for project and study codes."""

import pytest
from pydantic import TypeAdapter, ValidationError

from protolims_api.schemas.common import Code
from protolims_api.schemas.project import ProjectCreate
from protolims_api.schemas.study import StudyCreate

code = TypeAdapter(Code)


@pytest.mark.parametrize("value", ["new", "NEW", "New", "edit", "EDIT"])
def test_reserved_codes_are_rejected(value: str) -> None:
    with pytest.raises(ValidationError, match="reserved"):
        code.validate_python(value)


@pytest.mark.parametrize("value", ["TCGA-BRCA", "news", "renew", "new-1", "EDITS"])
def test_codes_containing_reserved_words_are_allowed(value: str) -> None:
    assert code.validate_python(value) == value


def test_project_and_study_codes_are_checked() -> None:
    with pytest.raises(ValidationError, match="reserved"):
        ProjectCreate(code="new", name="A project")
    with pytest.raises(ValidationError, match="reserved"):
        StudyCreate(code="New", title="A study")
