"""Tests for the subject endpoints."""

from datetime import datetime

from fastapi.testclient import TestClient
from sqlalchemy import Engine, text

API = "/api/v1"


def create_study(client: TestClient, project: str = "P1", study: str = "S1") -> str:
    """Create a study (and its project, if needed); return the study's subjects URL."""
    client.post(f"{API}/projects", json={"code": project, "name": f"Project {project}"})
    response = client.post(
        f"{API}/projects/{project}/studies", json={"code": study, "title": f"Study {study}"}
    )
    assert response.status_code == 201
    return f"{API}/projects/{project}/studies/{study}/subjects"


def test_create_and_get_subject(client: TestClient) -> None:
    subjects = create_study(client)
    payload = {
        "name": "TCGA-A1-A0SB",
        "external_id": "0004d251-3f70-4395-b175-c94c2f5b1b81",
        "subject_type": "patient",
        "species": "Homo sapiens",
        "attributes": {"sex": "female"},
    }
    response = client.post(subjects, json=payload)
    assert response.status_code == 201
    body = response.json()
    assert body["attributes"] == {"sex": "female"}
    assert (body["project_code"], body["study_code"]) == ("P1", "S1")

    response = client.get(f"{API}/subjects/{body['id']}")
    assert response.status_code == 200
    fetched = response.json()
    assert fetched["name"] == "TCGA-A1-A0SB"
    assert fetched["external_id"] == "0004d251-3f70-4395-b175-c94c2f5b1b81"
    assert (fetched["project_code"], fetched["study_code"]) == ("P1", "S1")


def test_names_may_contain_spaces(client: TestClient) -> None:
    subjects = create_study(client)
    payload = {"name": "Hs 578T", "subject_type": "cell_line"}
    assert client.post(subjects, json=payload).status_code == 201
    assert [s["name"] for s in client.get(subjects).json()["items"]] == ["Hs 578T"]


def test_invalid_names_are_rejected(client: TestClient) -> None:
    subjects = create_study(client)
    for name in ["", " leading space", "trailing space ", "has/slash"]:
        response = client.post(subjects, json={"name": name, "subject_type": "patient"})
        assert response.status_code == 422, name


def test_unknown_subject_type_is_rejected(client: TestClient) -> None:
    subjects = create_study(client)
    response = client.post(subjects, json={"name": "X1", "subject_type": "alien"})
    assert response.status_code == 422


def test_same_name_is_allowed_in_different_studies(client: TestClient) -> None:
    first = create_study(client, "P1", "S1")
    second = create_study(client, "P1", "S2")
    payload = {"name": "Patient-01", "subject_type": "patient"}
    assert client.post(first, json=payload).status_code == 201
    assert client.post(second, json=payload).status_code == 201


def test_duplicate_name_in_same_study_is_rejected(client: TestClient) -> None:
    subjects = create_study(client)
    payload = {"name": "Patient-01", "subject_type": "patient"}
    assert client.post(subjects, json=payload).status_code == 201
    response = client.post(subjects, json=payload)
    assert response.status_code == 409
    assert "S1" in response.json()["detail"]


def test_unknown_or_invalid_subject_id(client: TestClient) -> None:
    unknown = f"{API}/subjects/00000000-0000-7000-8000-000000000000"
    assert client.get(unknown).status_code == 404
    assert client.get(f"{API}/subjects/not-a-uuid").status_code == 422


def test_unknown_subject_returns_404(client: TestClient) -> None:
    subjects = create_study(client)
    assert client.get(f"{subjects}/NOPE").status_code == 404


def test_list_subjects_only_returns_that_studys_subjects(client: TestClient) -> None:
    first = create_study(client, "P1", "S1")
    second = create_study(client, "P1", "S2")
    client.post(first, json={"name": "B", "subject_type": "patient"})
    client.post(first, json={"name": "A", "subject_type": "patient"})
    client.post(second, json={"name": "C", "subject_type": "patient"})
    response = client.get(first)
    assert response.status_code == 200
    assert [s["name"] for s in response.json()["items"]] == ["A", "B"]
    assert response.json()["total"] == 2


def test_create_subject_records_audit_event(client: TestClient, database: Engine) -> None:
    subjects = create_study(client)
    client.post(subjects, json={"name": "X1", "subject_type": "patient"})
    with database.connect() as conn:
        rows = conn.execute(
            text("SELECT entity_type FROM audit_event ORDER BY occurred_at, id")
        ).all()
    assert [row[0] for row in rows] == ["project", "study", "subject"]


def add_subject(client: TestClient, subjects_url: str, name: str, **fields: object) -> None:
    response = client.post(subjects_url, json={"name": name, "subject_type": "patient", **fields})
    assert response.status_code == 201, response.json()


def list_names(client: TestClient, subjects_url: str, **params: str | int) -> list[str]:
    response = client.get(subjects_url, params=params)
    assert response.status_code == 200, response.json()
    return [s["name"] for s in response.json()["items"]]


def test_list_subjects_sorts_by_a_chosen_column(client: TestClient) -> None:
    subjects = create_study(client)
    add_subject(client, subjects, "A", species="Mus musculus")
    add_subject(client, subjects, "B", subject_type="cell_line", species="Homo sapiens")
    add_subject(client, subjects, "C", subject_type="organism")

    assert list_names(client, subjects) == ["A", "B", "C"]
    assert list_names(client, subjects, sort="-name") == ["C", "B", "A"]
    assert list_names(client, subjects, sort="subject_type") == ["B", "C", "A"]
    assert list_names(client, subjects, sort="species") == ["B", "A", "C"]
    assert list_names(client, subjects, sort="-species") == ["A", "B", "C"]


def test_list_subjects_rejects_an_unknown_sort(client: TestClient) -> None:
    subjects = create_study(client)
    assert client.get(subjects, params={"sort": "colour"}).status_code == 422


def test_list_subjects_searches_names_and_external_ids(client: TestClient) -> None:
    subjects = create_study(client)
    add_subject(client, subjects, "TCGA-A1-A0SB", external_id="0004d251")
    add_subject(client, subjects, "Hs 578T", subject_type="cell_line", external_id="CVCL_0332")
    add_subject(client, subjects, "50%_cells", subject_type="cell_line")

    assert list_names(client, subjects, q="tcga") == ["TCGA-A1-A0SB"]
    assert list_names(client, subjects, q="cvcl") == ["Hs 578T"]
    assert list_names(client, subjects, q="%") == ["50%_cells"]
    assert list_names(client, subjects, q="nothing") == []


def test_list_subjects_pages_through_results_with_a_total(client: TestClient) -> None:
    subjects = create_study(client)
    for name in ["A", "B", "C", "D", "E"]:
        add_subject(client, subjects, name)

    body = client.get(subjects, params={"limit": 2, "offset": 2}).json()
    assert [s["name"] for s in body["items"]] == ["C", "D"]
    assert body["total"] == 5


def create_subject_id(client: TestClient, subjects_url: str, name: str, **fields: object) -> str:
    response = client.post(subjects_url, json={"name": name, "subject_type": "patient", **fields})
    assert response.status_code == 201, response.json()
    subject_id: str = response.json()["id"]
    return subject_id


def test_update_subject_changes_only_the_fields_sent(client: TestClient, database: Engine) -> None:
    subjects = create_study(client)
    subject_id = create_subject_id(client, subjects, "Hs 578T", species="Homo sapiens")

    response = client.patch(
        f"{API}/subjects/{subject_id}",
        json={"subject_type": "cell_line", "attributes": {"cellosaurus": "CVCL_0332"}},
    )
    assert response.status_code == 200
    body = response.json()
    assert (body["name"], body["subject_type"], body["species"]) == (
        "Hs 578T",
        "cell_line",
        "Homo sapiens",
    )
    assert body["attributes"] == {"cellosaurus": "CVCL_0332"}
    assert (body["project_code"], body["study_code"]) == ("P1", "S1")
    assert datetime.fromisoformat(body["updated_at"]) > datetime.fromisoformat(body["created_at"])

    with database.connect() as conn:
        changes = conn.execute(
            text("SELECT changes FROM audit_event WHERE action = 'update'")
        ).scalar_one()
    assert changes == {
        "before": {"subject_type": "patient", "attributes": {}},
        "after": {"subject_type": "cell_line", "attributes": {"cellosaurus": "CVCL_0332"}},
    }


def test_update_subject_with_no_real_changes_records_nothing(
    client: TestClient, database: Engine
) -> None:
    subjects = create_study(client)
    subject_id = create_subject_id(client, subjects, "Patient-01")

    response = client.patch(f"{API}/subjects/{subject_id}", json={"name": "Patient-01"})
    assert response.status_code == 200

    with database.connect() as conn:
        updates = conn.execute(
            text("SELECT count(*) FROM audit_event WHERE action = 'update'")
        ).scalar_one()
    assert updates == 0


def test_update_subject_can_clear_optional_fields_but_not_required_ones(
    client: TestClient,
) -> None:
    subjects = create_study(client)
    subject_id = create_subject_id(
        client, subjects, "Patient-01", species="Homo sapiens", external_id="X-1"
    )

    response = client.patch(
        f"{API}/subjects/{subject_id}", json={"species": None, "external_id": None}
    )
    assert response.status_code == 200
    assert (response.json()["species"], response.json()["external_id"]) == (None, None)

    for fields in [
        {"name": None},
        {"subject_type": None},
        {"attributes": None},
        {"subject_type": "alien"},
        {"study_id": "00000000-0000-7000-8000-000000000000"},
    ]:
        assert client.patch(f"{API}/subjects/{subject_id}", json=fields).status_code == 422, fields


def test_update_subject_rejects_a_name_used_in_the_study(client: TestClient) -> None:
    subjects = create_study(client)
    create_subject_id(client, subjects, "Patient-01")
    second = create_subject_id(client, subjects, "Patient-02")

    response = client.patch(f"{API}/subjects/{second}", json={"name": "Patient-01"})
    assert response.status_code == 409


def test_update_unknown_subject_returns_404(client: TestClient) -> None:
    unknown = f"{API}/subjects/00000000-0000-7000-8000-000000000000"
    assert client.patch(unknown, json={"species": "Mus musculus"}).status_code == 404
