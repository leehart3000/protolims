"""Tests for the sample endpoints."""

from datetime import datetime

from fastapi.testclient import TestClient
from sqlalchemy import Engine, text

API = "/api/v1"


def create_study(client: TestClient, project: str = "P1", study: str = "S1") -> str:
    """Create a study (and its project, if needed); return the study's URL."""
    client.post(f"{API}/projects", json={"code": project, "name": f"Project {project}"})
    response = client.post(
        f"{API}/projects/{project}/studies", json={"code": study, "title": f"Study {study}"}
    )
    assert response.status_code == 201
    return f"{API}/projects/{project}/studies/{study}"


def create_subject(client: TestClient, study_url: str, name: str = "Patient-01") -> str:
    response = client.post(f"{study_url}/subjects", json={"name": name, "subject_type": "patient"})
    assert response.status_code == 201
    subject_id: str = response.json()["id"]
    return subject_id


def create_sample(client: TestClient, study_url: str, name: str, **fields: object) -> str:
    response = client.post(
        f"{study_url}/samples", json={"name": name, "material_type": "tissue", **fields}
    )
    assert response.status_code == 201, response.json()
    sample_id: str = response.json()["id"]
    return sample_id


def test_create_and_get_samples_with_subject_and_parent(client: TestClient) -> None:
    study = create_study(client)
    subject_id = create_subject(client, study)
    response = client.post(
        f"{study}/samples",
        json={
            "name": "S1",
            "material_type": "tissue",
            "subject_id": subject_id,
            "collected_at": "2026-10-01T09:00:00Z",
            "characteristics": {"tissue site": "breast"},
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "registered"
    assert body["subject_name"] == "Patient-01"
    assert (body["project_code"], body["study_code"]) == ("P1", "S1")

    aliquot_id = create_sample(
        client, study, "S1-RNA", material_type="RNA", parent_sample_id=body["id"]
    )
    response = client.get(f"{API}/samples/{aliquot_id}")
    assert response.status_code == 200
    aliquot = response.json()
    assert aliquot["material_type"] == "RNA"
    assert aliquot["parent_sample_name"] == "S1"
    # A derived sample has its parent's subject.
    assert aliquot["subject_name"] == "Patient-01"


def test_invalid_details_are_rejected(client: TestClient) -> None:
    study = create_study(client)
    for fields in [
        {"name": "has/slash", "material_type": "tissue"},
        {"name": "S1", "material_type": ""},
        {"name": "S1", "material_type": "tissue", "status": "lost"},
        {"name": "S1", "material_type": "tissue", "collected_at": "2026-10-01T09:00:00"},
    ]:
        response = client.post(f"{study}/samples", json=fields)
        assert response.status_code == 422, fields


def test_same_name_is_allowed_in_different_studies(client: TestClient) -> None:
    create_sample(client, create_study(client, "P1", "S1"), "Sample-01")
    create_sample(client, create_study(client, "P1", "S2"), "Sample-01")


def test_duplicate_name_in_same_study_is_rejected(client: TestClient) -> None:
    study = create_study(client)
    create_sample(client, study, "Sample-01")
    response = client.post(f"{study}/samples", json={"name": "Sample-01", "material_type": "blood"})
    assert response.status_code == 409


def test_subject_must_be_in_the_same_study(client: TestClient) -> None:
    first = create_study(client, "P1", "S1")
    second = create_study(client, "P1", "S2")
    other_subject = create_subject(client, second)
    for subject_id in [other_subject, "00000000-0000-7000-8000-000000000000"]:
        response = client.post(
            f"{first}/samples",
            json={"name": "X1", "material_type": "tissue", "subject_id": subject_id},
        )
        assert response.status_code == 422
        assert "subject" in response.json()["detail"]


def test_parent_must_be_in_the_same_study(client: TestClient) -> None:
    first = create_study(client, "P1", "S1")
    second = create_study(client, "P1", "S2")
    other_sample = create_sample(client, second, "Other")
    for parent_id in [other_sample, "00000000-0000-7000-8000-000000000000"]:
        response = client.post(
            f"{first}/samples",
            json={"name": "X1", "material_type": "tissue", "parent_sample_id": parent_id},
        )
        assert response.status_code == 422
        assert "parent" in response.json()["detail"]


def test_unknown_study_returns_404(client: TestClient) -> None:
    create_study(client)
    unknown = f"{API}/projects/P1/studies/NOPE/samples"
    assert client.post(unknown, json={"name": "X1", "material_type": "tissue"}).status_code == 404
    assert client.get(unknown).status_code == 404


def test_unknown_or_invalid_sample_id(client: TestClient) -> None:
    assert client.get(f"{API}/samples/00000000-0000-7000-8000-000000000000").status_code == 404
    assert client.get(f"{API}/samples/not-a-uuid").status_code == 422


def test_list_samples_only_returns_that_studys_samples(client: TestClient) -> None:
    first = create_study(client, "P1", "S1")
    second = create_study(client, "P1", "S2")
    subject_id = create_subject(client, first)
    create_sample(client, first, "B", subject_id=subject_id)
    create_sample(client, first, "A")
    create_sample(client, second, "C")
    response = client.get(f"{first}/samples")
    assert response.status_code == 200
    body = response.json()
    assert [(s["name"], s["subject_name"]) for s in body["items"]] == [
        ("A", None),
        ("B", "Patient-01"),
    ]
    assert body["total"] == 2


def test_create_sample_records_audit_event(client: TestClient, database: Engine) -> None:
    study = create_study(client)
    create_sample(client, study, "X1")
    with database.connect() as conn:
        rows = conn.execute(
            text("SELECT entity_type FROM audit_event ORDER BY occurred_at, id")
        ).all()
    assert [row[0] for row in rows] == ["project", "study", "sample"]


def test_list_samples_can_filter_by_parent(client: TestClient) -> None:
    study = create_study(client)
    parent_id = create_sample(client, study, "S1")
    create_sample(client, study, "S1-RNA", parent_sample_id=parent_id)
    create_sample(client, study, "S2")
    response = client.get(f"{study}/samples", params={"parent": parent_id})
    assert response.status_code == 200
    assert [s["name"] for s in response.json()["items"]] == ["S1-RNA"]


def list_names(client: TestClient, study_url: str, **params: str | int) -> list[str]:
    response = client.get(f"{study_url}/samples", params=params)
    assert response.status_code == 200, response.json()
    return [s["name"] for s in response.json()["items"]]


def test_list_samples_sorts_by_a_chosen_column(client: TestClient) -> None:
    study = create_study(client)
    subject_id = create_subject(client, study)
    create_sample(client, study, "A", material_type="RNA", status="registered")
    create_sample(client, study, "B", material_type="DNA", subject_id=subject_id, status="in_use")
    create_sample(client, study, "C", material_type="tissue", status="consumed")

    assert list_names(client, study) == ["A", "B", "C"]
    assert list_names(client, study, sort="-name") == ["C", "B", "A"]
    assert list_names(client, study, sort="material_type") == ["B", "A", "C"]
    assert list_names(client, study, sort="status") == ["C", "B", "A"]
    assert list_names(client, study, sort="subject") == ["B", "A", "C"]
    assert list_names(client, study, sort="-subject") == ["B", "A", "C"]


def test_list_samples_rejects_an_unknown_sort(client: TestClient) -> None:
    study = create_study(client)
    assert client.get(f"{study}/samples", params={"sort": "colour"}).status_code == 422


def test_list_samples_searches_names_and_external_ids(client: TestClient) -> None:
    study = create_study(client)
    create_sample(client, study, "Tumour-01")
    create_sample(client, study, "Normal-01", external_id="GDC-TUM-99")
    create_sample(client, study, "100%_pure")

    assert list_names(client, study, q="tum") == ["Normal-01", "Tumour-01"]
    assert list_names(client, study, q="%") == ["100%_pure"]
    assert list_names(client, study, q="_") == ["100%_pure"]
    assert list_names(client, study, q="nothing") == []


def test_list_samples_pages_through_results_with_a_total(client: TestClient) -> None:
    study = create_study(client)
    for name in ["A", "B", "C", "D", "E"]:
        create_sample(client, study, name)

    body = client.get(f"{study}/samples", params={"limit": 2, "offset": 2}).json()
    assert [s["name"] for s in body["items"]] == ["C", "D"]
    assert body["total"] == 5

    body = client.get(f"{study}/samples", params={"q": "a", "limit": 1}).json()
    assert [s["name"] for s in body["items"]] == ["A"]
    assert body["total"] == 1


def test_list_samples_can_filter_by_subject(client: TestClient) -> None:
    study = create_study(client)
    first = create_subject(client, study, "Patient-01")
    second = create_subject(client, study, "Patient-02")
    create_sample(client, study, "S1", subject_id=first)
    create_sample(client, study, "S2", subject_id=second)
    create_sample(client, study, "S3")

    assert list_names(client, study, subject=first) == ["S1"]
    assert list_names(client, study, subject=second) == ["S2"]


def test_update_sample_changes_only_the_fields_sent(client: TestClient, database: Engine) -> None:
    study = create_study(client)
    subject_id = create_subject(client, study)
    sample_id = create_sample(client, study, "S1", subject_id=subject_id)

    response = client.patch(
        f"{API}/samples/{sample_id}", json={"status": "in_storage", "material_type": "blood"}
    )
    assert response.status_code == 200
    body = response.json()
    assert (body["name"], body["status"], body["material_type"]) == ("S1", "in_storage", "blood")
    assert body["subject_name"] == "Patient-01"
    assert datetime.fromisoformat(body["updated_at"]) > datetime.fromisoformat(body["created_at"])

    with database.connect() as conn:
        changes = conn.execute(
            text("SELECT changes FROM audit_event WHERE action = 'update'")
        ).scalar_one()
    assert changes == {
        "before": {"status": "registered", "material_type": "tissue"},
        "after": {"status": "in_storage", "material_type": "blood"},
    }


def test_update_sample_with_no_real_changes_records_nothing(
    client: TestClient, database: Engine
) -> None:
    study = create_study(client)
    sample_id = create_sample(client, study, "S1")

    assert client.patch(f"{API}/samples/{sample_id}", json={"name": "S1"}).status_code == 200

    with database.connect() as conn:
        updates = conn.execute(
            text("SELECT count(*) FROM audit_event WHERE action = 'update'")
        ).scalar_one()
    assert updates == 0


def test_update_sample_can_clear_optional_fields_but_not_required_ones(
    client: TestClient,
) -> None:
    study = create_study(client)
    subject_id = create_subject(client, study)
    sample_id = create_sample(client, study, "S1", subject_id=subject_id, external_id="X-1")

    response = client.patch(
        f"{API}/samples/{sample_id}", json={"subject_id": None, "external_id": None}
    )
    assert response.status_code == 200
    assert (response.json()["subject_name"], response.json()["external_id"]) == (None, None)

    for fields in [
        {"name": None},
        {"material_type": None},
        {"status": None},
        {"study_id": "00000000-0000-7000-8000-000000000000"},
    ]:
        assert client.patch(f"{API}/samples/{sample_id}", json=fields).status_code == 422, fields


def test_update_sample_rejects_a_name_used_in_the_study(client: TestClient) -> None:
    study = create_study(client)
    create_sample(client, study, "S1")
    second = create_sample(client, study, "S2")

    response = client.patch(f"{API}/samples/{second}", json={"name": "S1"})
    assert response.status_code == 409


def test_update_sample_checks_links_are_in_the_same_study(client: TestClient) -> None:
    first = create_study(client, "P1", "S1")
    second = create_study(client, "P1", "S2")
    sample_id = create_sample(client, first, "X1")
    other_subject = create_subject(client, second)
    other_sample = create_sample(client, second, "Other")

    for fields in [{"subject_id": other_subject}, {"parent_sample_id": other_sample}]:
        assert client.patch(f"{API}/samples/{sample_id}", json=fields).status_code == 422, fields


def test_update_sample_cannot_make_a_loop(client: TestClient) -> None:
    study = create_study(client)
    a = create_sample(client, study, "A")
    b = create_sample(client, study, "B", parent_sample_id=a)
    c = create_sample(client, study, "C", parent_sample_id=b)

    for parent in [a, c]:
        response = client.patch(f"{API}/samples/{a}", json={"parent_sample_id": parent})
        assert response.status_code == 422, parent
        assert "derived" in response.json()["detail"]

    response = client.patch(f"{API}/samples/{c}", json={"parent_sample_id": a})
    assert response.status_code == 200
    assert response.json()["parent_sample_name"] == "A"


def test_update_unknown_sample_returns_404(client: TestClient) -> None:
    unknown = f"{API}/samples/00000000-0000-7000-8000-000000000000"
    assert client.patch(unknown, json={"status": "in_use"}).status_code == 404


DERIVED_SUBJECT = (
    "A derived sample's subject is its parent sample's, so it can't be set to another "
    "(leave it out, or change the parent's)"
)


def subject_names(client: TestClient, *sample_ids: str) -> list[str | None]:
    return [client.get(f"{API}/samples/{i}").json()["subject_name"] for i in sample_ids]


def test_a_derived_sample_has_its_parents_subject(client: TestClient) -> None:
    study = create_study(client)
    first = create_subject(client, study, "Patient-01")
    second = create_subject(client, study, "Patient-02")
    tissue = create_sample(client, study, "T1", subject_id=first)

    # Given or left out, the subject is the parent's; another is refused.
    same = create_sample(client, study, "T1-DNA", parent_sample_id=tissue, subject_id=first)
    response = client.post(
        f"{study}/samples",
        json={
            "name": "X",
            "material_type": "RNA",
            "parent_sample_id": tissue,
            "subject_id": second,
        },
    )
    assert (response.status_code, response.json()["detail"]) == (422, DERIVED_SUBJECT)
    assert subject_names(client, same) == ["Patient-01"]

    # Nor can it be changed on its own; clearing it leaves it as the parent's.
    response = client.patch(f"{API}/samples/{same}", json={"subject_id": second})
    assert (response.status_code, response.json()["detail"]) == (422, DERIVED_SUBJECT)
    response = client.patch(f"{API}/samples/{same}", json={"subject_id": None})
    assert (response.status_code, response.json()["subject_name"]) == (200, "Patient-01")


def test_derived_samples_follow_their_parents_subject(client: TestClient, database: Engine) -> None:
    study = create_study(client)
    first = create_subject(client, study, "Patient-01")
    second = create_subject(client, study, "Patient-02")
    tissue = create_sample(client, study, "T1", subject_id=first)
    rna = create_sample(client, study, "T1-RNA", parent_sample_id=tissue)
    library = create_sample(client, study, "T1-RNA-LIB", parent_sample_id=rna)
    other = create_sample(client, study, "T2", subject_id=second)

    # Changing the top sample's subject changes every sample derived from it, with an audit
    # entry for each.
    response = client.patch(f"{API}/samples/{tissue}", json={"subject_id": second})
    assert response.status_code == 200
    assert subject_names(client, tissue, rna, library) == ["Patient-02"] * 3
    with database.connect() as conn:
        reasons = conn.execute(
            text(
                "SELECT count(*) FROM audit_event"
                " WHERE changes->>'reason' = 'it follows its parent sample''s subject'"
            )
        ).scalar_one()
    assert reasons == 2

    # Moving a sample to a parent with another subject takes that subject, for its own derived
    # samples too.
    client.patch(f"{API}/samples/{tissue}", json={"subject_id": first})
    response = client.patch(f"{API}/samples/{rna}", json={"parent_sample_id": other})
    assert response.json()["subject_name"] == "Patient-02"
    assert subject_names(client, tissue, rna, library) == ["Patient-01", "Patient-02", "Patient-02"]

    # Taking a sample's parent away keeps its subject, which can then be changed.
    response = client.patch(f"{API}/samples/{rna}", json={"parent_sample_id": None})
    assert (response.json()["parent_sample_name"], response.json()["subject_name"]) == (
        None,
        "Patient-02",
    )
    response = client.patch(f"{API}/samples/{rna}", json={"subject_id": first})
    assert subject_names(client, rna, library) == ["Patient-01", "Patient-01"]
