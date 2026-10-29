"""Things shared by several test files."""

from collections.abc import Callable
from typing import Any

from fastapi.testclient import TestClient

# The tests' site administrator (PROTOLIMS_SITE_ADMINS, set in conftest.py), and the label
# their changes are recorded with in created_by and the audit trail.
SITE_ADMIN = "0000-0001-5109-3700"
BY_SITE_ADMIN = f"orcid:{SITE_ADMIN}"

# Other people, by ORCID iD (with valid check digits), who have only the roles a test gives.
ALICE = "0000-0001-2345-6789"
BOB = "0000-0009-8765-4328"
CAROL = "0000-0001-1111-1118"
DAVE = "0000-0002-2222-2224"

# The sign_in_as fixture (see conftest.py): sign in by ORCID iD, get the request headers.
SignIn = Callable[..., dict[str, str]]

API = "/api/v1"
PROJECT = f"{API}/projects/P1"
STUDY = f"{PROJECT}/studies/S1"
OTHER_STUDY = f"{PROJECT}/studies/S2"


def created_id(response: Any) -> str:
    assert response.status_code == 201, response.json()
    record_id: str = response.json()["id"]
    return record_id


def make_records(client: TestClient) -> dict[str, str]:
    """As the site administrator: project P1 with studies S1 and S2, and in S1 a subject, a
    sample, an assay and two data files. Returns their IDs."""
    assert client.post(f"{API}/projects", json={"code": "P1", "name": "P1"}).status_code == 201
    for code in ("S1", "S2"):
        response = client.post(f"{PROJECT}/studies", json={"code": code, "title": code})
        assert response.status_code == 201
    file = {"level": "raw", "format": "BAM"}
    return {
        "subject": created_id(
            client.post(f"{STUDY}/subjects", json={"name": "P-1", "subject_type": "patient"})
        ),
        "sample": created_id(
            client.post(f"{STUDY}/samples", json={"name": "T-1", "material_type": "tissue"})
        ),
        "assay": created_id(
            client.post(
                f"{STUDY}/assays",
                json={"name": "Run-1", "measurement_type": "m", "technology_type": "t"},
            )
        ),
        "file": created_id(
            client.post(
                f"{STUDY}/data-files",
                json={"name": "a.bam", "uri": "https://example.org/a.bam", **file},
            )
        ),
        "other_file": created_id(
            client.post(
                f"{STUDY}/data-files",
                json={"name": "b.bam", "uri": "https://example.org/b.bam", **file},
            )
        ),
    }


def every_change(ids: dict[str, str]) -> list[tuple[str, str, Any]]:
    """Every kind of change the API allows (other than to roles), as (method, URL, body)."""
    assay_sample = f"{API}/assays/{ids['assay']}/samples/{ids['sample']}"
    file_sample = f"{API}/data-files/{ids['file']}/samples/{ids['sample']}"
    file_input = f"{API}/data-files/{ids['file']}/inputs/{ids['other_file']}"
    return [
        ("POST", f"{API}/projects", {"code": "P9", "name": "P9"}),
        ("PATCH", PROJECT, {"name": "Renamed"}),
        ("POST", f"{PROJECT}/studies", {"code": "S9", "title": "S9"}),
        ("PATCH", STUDY, {"title": "Renamed"}),
        ("POST", f"{STUDY}/subjects", {"name": "P-2", "subject_type": "patient"}),
        ("PATCH", f"{API}/subjects/{ids['subject']}", {"name": "P-3"}),
        ("POST", f"{STUDY}/samples", {"name": "T-2", "material_type": "tissue"}),
        ("PATCH", f"{API}/samples/{ids['sample']}", {"name": "T-3"}),
        (
            "POST",
            f"{STUDY}/assays",
            {"name": "Run-2", "measurement_type": "m", "technology_type": "t"},
        ),
        ("PATCH", f"{API}/assays/{ids['assay']}", {"name": "Run-3"}),
        ("PUT", assay_sample, {}),
        ("DELETE", assay_sample, None),
        (
            "POST",
            f"{STUDY}/data-files",
            {"name": "c.bam", "uri": "https://example.org/c.bam", "level": "raw", "format": "BAM"},
        ),
        ("PATCH", f"{API}/data-files/{ids['file']}", {"name": "d.bam"}),
        ("PUT", file_sample, {}),
        ("DELETE", file_sample, None),
        ("PUT", file_input, None),
        ("DELETE", file_input, None),
        ("POST", f"{STUDY}/import", {"source": "test", "dry_run": True}),
    ]
