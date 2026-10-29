"""Tests for ORCID iDs, the site administrators setting, and comparing roles."""

import pytest
from pydantic import ValidationError

from protolims_api.config import Settings
from protolims_api.orcid import is_orcid_id
from protolims_api.permissions import higher


def test_orcid_ids_are_checked_including_their_check_digit() -> None:
    for valid in ["0000-0002-1825-0097", "0000-0002-1694-233X", "0009-0009-7608-4486"]:
        assert is_orcid_id(valid), valid
    for invalid in [
        "0000-0002-1825-0098",  # wrong check digit
        "0000-0002-1694-2330",
        "0000000218250097",
        "https://orcid.org/0000-0002-1825-0097",
        "0000-0002-1825-009x",
        "",
    ]:
        assert not is_orcid_id(invalid), invalid


def test_site_admins_are_a_list_of_orcid_ids(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PROTOLIMS_SITE_ADMINS", " 0000-0002-1825-0097, 0000-0001-5109-3700 ,")
    assert Settings().site_admins == ["0000-0002-1825-0097", "0000-0001-5109-3700"]
    assert Settings(site_admins=["0000-0002-1825-0097"]).site_admins == ["0000-0002-1825-0097"]

    monkeypatch.setenv("PROTOLIMS_SITE_ADMINS", "0000-0002-1825-0098")
    with pytest.raises(ValidationError, match="isn't a valid ORCID iD"):
        Settings()


def test_the_higher_of_two_roles_wins() -> None:
    assert higher(None, None) is None
    assert higher("viewer", None) == "viewer"
    assert higher(None, "editor") == "editor"
    assert higher("admin", "editor") == "admin"
    assert higher("viewer", "admin") == "admin"
