"""Tests of the lists of every subject, sample, assay and data file, across all studies.

Each lists only the records in studies the person can see, with each record's project and
study codes, and searches, sorts and pages like a study's own list.
"""

from typing import Any

import pytest
from fastapi.testclient import TestClient
from helpers import ALICE, API, BOB, DAVE, OTHER_STUDY, SignIn, make_records

KINDS = ("subjects", "samples", "assays", "data-files")


def names(response: Any) -> list[str]:
    assert response.status_code == 200, response.json()
    return [item["name"] for item in response.json()["items"]]


def add_records_to_other_study(client: TestClient) -> None:
    """In S2: a subject, a sample, an assay and a data file, all named with a 2."""
    file = {"level": "processed", "format": "VCF", "uri": "https://example.org/c.vcf"}
    for kind, body in (
        ("subjects", {"name": "P-2", "subject_type": "patient"}),
        ("samples", {"name": "T-2", "material_type": "blood"}),
        ("assays", {"name": "Run-2", "measurement_type": "m", "technology_type": "t"}),
        ("data-files", {"name": "c.vcf", **file}),
    ):
        assert client.post(f"{OTHER_STUDY}/{kind}", json=body).status_code == 201


def test_every_record_is_listed_with_its_project_and_study(client: TestClient) -> None:
    make_records(client)
    add_records_to_other_study(client)

    assert names(client.get(f"{API}/subjects")) == ["P-1", "P-2"]
    assert names(client.get(f"{API}/samples")) == ["T-1", "T-2"]
    assert names(client.get(f"{API}/assays")) == ["Run-1", "Run-2"]
    assert names(client.get(f"{API}/data-files")) == ["a.bam", "b.bam", "c.vcf"]

    for kind in KINDS:
        items = client.get(f"{API}/{kind}").json()["items"]
        assert {(item["project_code"], item["study_code"]) for item in items} == {
            ("P1", "S1"),
            ("P1", "S2"),
        }, kind


@pytest.mark.parametrize(
    ("kind", "q", "sort", "expected"),
    [
        ("subjects", "2", "name", ["P-2"]),
        ("subjects", None, "-name", ["P-2", "P-1"]),
        ("samples", "t-", "-material_type", ["T-1", "T-2"]),
        ("assays", "RUN", "-name", ["Run-2", "Run-1"]),
        ("data-files", "example.org/c", "name", ["c.vcf"]),
        ("data-files", None, "-level", ["a.bam", "b.bam", "c.vcf"]),
    ],
)
def test_the_lists_can_be_searched_and_sorted(
    client: TestClient, kind: str, q: str | None, sort: str, expected: list[str]
) -> None:
    make_records(client)
    add_records_to_other_study(client)
    params = {"sort": sort}
    if q is not None:
        params["q"] = q
    assert names(client.get(f"{API}/{kind}", params=params)) == expected


def test_the_lists_are_paged_and_data_files_can_be_filtered_by_level(
    client: TestClient,
) -> None:
    make_records(client)
    add_records_to_other_study(client)

    page = client.get(f"{API}/data-files", params={"limit": 2, "offset": 2}).json()
    assert ([item["name"] for item in page["items"]], page["total"]) == (["c.vcf"], 3)
    assert names(client.get(f"{API}/data-files", params={"level": "processed"})) == ["c.vcf"]
    assert client.get(f"{API}/data-files", params={"level": "processed"}).json()["total"] == 1


def add_another_project(client: TestClient) -> None:
    """Project P0 with a study S1, holding a subject, a sample, an assay and a data file, all
    named with a 0: its study has the same code as P1's first study."""
    assert client.post(f"{API}/projects", json={"code": "P0", "name": "P0"}).status_code == 201
    study = f"{API}/projects/P0/studies/S1"
    response = client.post(f"{API}/projects/P0/studies", json={"code": "S1", "title": "S1"})
    assert response.status_code == 201
    file = {"level": "raw", "format": "BAM", "uri": "https://example.org/z.bam"}
    for kind, body in (
        ("subjects", {"name": "P-0", "subject_type": "patient"}),
        ("samples", {"name": "T-0", "material_type": "tissue"}),
        ("assays", {"name": "Run-0", "measurement_type": "m", "technology_type": "t"}),
        ("data-files", {"name": "z.bam", **file}),
    ):
        assert client.post(f"{study}/{kind}", json=body).status_code == 201


@pytest.mark.parametrize(
    ("kind", "everything", "in_s1_of_p1", "in_p0"),
    [
        ("subjects", ["P-0", "P-1", "P-2"], ["P-1"], ["P-0"]),
        ("samples", ["T-0", "T-1", "T-2"], ["T-1"], ["T-0"]),
        ("assays", ["Run-0", "Run-1", "Run-2"], ["Run-1"], ["Run-0"]),
        ("data-files", ["a.bam", "b.bam", "c.vcf", "z.bam"], ["a.bam", "b.bam"], ["z.bam"]),
    ],
)
def test_the_lists_can_be_filtered_by_project_and_study(
    client: TestClient, kind: str, everything: list[str], in_s1_of_p1: list[str], in_p0: list[str]
) -> None:
    make_records(client)
    add_records_to_other_study(client)
    add_another_project(client)

    assert names(client.get(f"{API}/{kind}")) == everything
    assert names(client.get(f"{API}/{kind}", params={"project": "P0"})) == in_p0
    both = client.get(f"{API}/{kind}", params={"project": "P1", "study": "S1"})
    assert names(both) == in_s1_of_p1
    assert both.json()["total"] == len(in_s1_of_p1)
    # A study code alone matches that study in every project.
    assert names(client.get(f"{API}/{kind}", params={"study": "S1"})) == sorted(in_s1_of_p1 + in_p0)
    assert client.get(f"{API}/{kind}", params={"project": "NOPE"}).json()["total"] == 0


@pytest.mark.parametrize("kind", KINDS)
def test_the_lists_can_be_sorted_by_study(client: TestClient, kind: str) -> None:
    make_records(client)
    add_records_to_other_study(client)
    add_another_project(client)

    def studies(sort: str) -> list[tuple[str, str]]:
        items = client.get(f"{API}/{kind}", params={"sort": sort}).json()["items"]
        return [(item["project_code"], item["study_code"]) for item in items]

    # By project code, then study code, then name.
    ascending = studies("study")
    assert ascending == sorted(ascending)
    assert ascending[0] == ("P0", "S1")
    assert ascending[-1] == ("P1", "S2")
    assert studies("-study") == sorted(ascending, reverse=True)


def test_only_records_in_studies_someone_can_see_are_listed(
    client: TestClient, sign_in_as: SignIn, private: None
) -> None:
    make_records(client)  # The records are in S1.
    add_records_to_other_study(client)
    client.put(f"{OTHER_STUDY}/members/{BOB}", json={"role": "viewer"})
    client.put(f"{API}/projects/P1/members/{ALICE}", json={"role": "viewer"})
    alice, bob, dave = sign_in_as(ALICE), sign_in_as(BOB), sign_in_as(DAVE)

    # A project role shows every study's records; a study role only that study's.
    assert names(client.get(f"{API}/subjects", headers=alice)) == ["P-1", "P-2"]
    assert names(client.get(f"{API}/subjects", headers=bob)) == ["P-2"]
    assert names(client.get(f"{API}/samples", headers=bob)) == ["T-2"]
    assert names(client.get(f"{API}/assays", headers=bob)) == ["Run-2"]
    assert names(client.get(f"{API}/data-files", headers=bob)) == ["c.vcf"]

    # The totals count only what can be seen, so they give nothing away.
    for kind in KINDS:
        assert client.get(f"{API}/{kind}", headers=bob).json()["total"] == 1, kind
        assert client.get(f"{API}/{kind}", headers=dave).json() == {"items": [], "total": 0}


def test_a_private_instance_needs_signing_in_for_the_lists(
    anonymous: TestClient, private: None
) -> None:
    for kind in KINDS:
        assert anonymous.get(f"{API}/{kind}").status_code == 401, kind
