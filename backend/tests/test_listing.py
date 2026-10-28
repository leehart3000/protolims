"""Sorting, searching and paging the project and study lists."""

from typing import Any

from fastapi.testclient import TestClient

API = "/api/v1"


def make_project(client: TestClient, code: str, name: str) -> None:
    response = client.post(f"{API}/projects", json={"code": code, "name": name})
    assert response.status_code == 201, response.json()


def make_study(client: TestClient, project: str, code: str, title: str) -> None:
    response = client.post(f"{API}/projects/{project}/studies", json={"code": code, "title": title})
    assert response.status_code == 201, response.json()


def codes(body: dict[str, Any]) -> list[str]:
    return [item["code"] for item in body["items"]]


def places(body: dict[str, Any]) -> list[tuple[str, str]]:
    """Each study in a page of all studies, as (project code, study code)."""
    return [(item["project_code"], item["code"]) for item in body["items"]]


def test_projects_can_be_sorted_searched_and_paged(client: TestClient) -> None:
    make_project(client, "B-PROJ", "Alpha")
    make_project(client, "A-PROJ", "Beta")
    make_project(client, "C-PROJ", "Gamma 50%")
    url = f"{API}/projects"

    body = client.get(url).json()
    assert (codes(body), body["total"]) == (["A-PROJ", "B-PROJ", "C-PROJ"], 3)
    assert codes(client.get(url, params={"sort": "name"}).json()) == [
        "B-PROJ",
        "A-PROJ",
        "C-PROJ",
    ]
    assert codes(client.get(url, params={"sort": "-code"}).json()) == [
        "C-PROJ",
        "B-PROJ",
        "A-PROJ",
    ]

    body = client.get(url, params={"q": "ALPHA"}).json()
    assert (codes(body), body["total"]) == (["B-PROJ"], 1)
    assert codes(client.get(url, params={"q": "a-pro"}).json()) == ["A-PROJ"]
    # "%" is matched as itself, not as a wildcard.
    assert codes(client.get(url, params={"q": "50%"}).json()) == ["C-PROJ"]

    body = client.get(url, params={"limit": 2, "offset": 2}).json()
    assert (codes(body), body["total"]) == (["C-PROJ"], 3)
    assert client.get(url, params={"sort": "nonsense"}).status_code == 422


def test_a_projects_studies_can_be_sorted_searched_and_paged(client: TestClient) -> None:
    make_project(client, "P1", "Project one")
    make_project(client, "P2", "Project two")
    make_study(client, "P1", "S2", "Alpha")
    make_study(client, "P1", "S1", "Beta")
    make_study(client, "P2", "S3", "Alpha too")
    url = f"{API}/projects/P1/studies"

    body = client.get(url).json()
    assert (codes(body), body["total"]) == (["S1", "S2"], 2)
    assert codes(client.get(url, params={"sort": "title"}).json()) == ["S2", "S1"]
    assert codes(client.get(url, params={"sort": "-code"}).json()) == ["S2", "S1"]
    assert codes(client.get(url, params={"q": "alpha"}).json()) == ["S2"]

    body = client.get(url, params={"limit": 1, "offset": 1}).json()
    assert (codes(body), body["total"]) == (["S2"], 2)


def test_all_studies_can_be_sorted_searched_and_paged(client: TestClient) -> None:
    make_project(client, "P1", "Project one")
    make_project(client, "P2", "Project two")
    make_study(client, "P2", "S1", "Gamma")
    make_study(client, "P1", "S2", "Alpha")
    make_study(client, "P1", "S1", "Beta")
    url = f"{API}/studies"

    body = client.get(url).json()
    assert (places(body), body["total"]) == ([("P1", "S1"), ("P1", "S2"), ("P2", "S1")], 3)
    assert places(client.get(url, params={"sort": "-project"}).json()) == [
        ("P2", "S1"),
        ("P1", "S1"),
        ("P1", "S2"),
    ]
    assert places(client.get(url, params={"sort": "code"}).json()) == [
        ("P1", "S1"),
        ("P2", "S1"),
        ("P1", "S2"),
    ]
    assert places(client.get(url, params={"sort": "title"}).json()) == [
        ("P1", "S2"),
        ("P1", "S1"),
        ("P2", "S1"),
    ]

    assert places(client.get(url, params={"q": "alpha"}).json()) == [("P1", "S2")]
    assert places(client.get(url, params={"q": "p2"}).json()) == [("P2", "S1")]

    body = client.get(url, params={"project": "P1", "limit": 1}).json()
    assert (places(body), body["total"]) == ([("P1", "S1")], 2)
