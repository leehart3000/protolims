"""Tests of what a sample or subject was measured in: its assays and data files, and the files
that hold the data of all of an assay's samples (such as a TMT plex's spectra)."""

from fastapi.testclient import TestClient
from helpers import API, PROJECT, STUDY, created_id

UNKNOWN = "00000000-0000-7000-8000-000000000000"


def make_study(client: TestClient) -> dict[str, str]:
    """Patient P-1, with a tissue sample whose protein was in a TMT plex and whose RNA was
    sequenced; patient P-2, whose RNA was sequenced too; and P-3, with no samples. The plex's
    spectra files have no samples of their own; each counts file has its sample."""
    client.post(f"{API}/projects", json={"code": "P1", "name": "P1"})
    client.post(f"{PROJECT}/studies", json={"code": "S1", "title": "S1"})
    ids: dict[str, str] = {}
    for key, name in [("patient", "P-1"), ("other", "P-2"), ("no_samples", "P-3")]:
        ids[key] = created_id(
            client.post(f"{STUDY}/subjects", json={"name": name, "subject_type": "patient"})
        )
    ids["tissue"] = created_id(
        client.post(
            f"{STUDY}/samples",
            json={"name": "T-1", "material_type": "tissue", "subject_id": ids["patient"]},
        )
    )
    for key, name, material, parent in [
        ("protein", "T-1-P", "protein", ids["tissue"]),
        ("rna", "T-1-R", "RNA", ids["tissue"]),
    ]:
        ids[key] = created_id(
            client.post(
                f"{STUDY}/samples",
                json={"name": name, "material_type": material, "parent_sample_id": parent},
            )
        )
    ids["other_rna"] = created_id(
        client.post(
            f"{STUDY}/samples",
            json={"name": "T-2-R", "material_type": "RNA", "subject_id": ids["other"]},
        )
    )
    for key, name in [("plex", "Plex-1"), ("rnaseq", "RNA-seq")]:
        ids[key] = created_id(
            client.post(
                f"{STUDY}/assays",
                json={"name": name, "measurement_type": "m", "technology_type": "t"},
            )
        )
    client.put(f"{API}/assays/{ids['plex']}/samples/{ids['protein']}", json={"label": "TMT 126"})
    client.put(f"{API}/assays/{ids['rnaseq']}/samples/{ids['rna']}", json={})
    client.put(f"{API}/assays/{ids['rnaseq']}/samples/{ids['other_rna']}", json={})

    for key, name, assay in [
        ("f01", "f01.raw", "plex"),
        ("f02", "f02.raw", "plex"),
        ("counts_1", "counts-1.tsv", "rnaseq"),
        ("counts_2", "counts-2.tsv", "rnaseq"),
    ]:
        ids[key] = created_id(
            client.post(
                f"{STUDY}/data-files",
                json={
                    "name": name,
                    "level": "raw",
                    "format": "RAW",
                    "uri": f"https://example.org/{name}",
                    "assay_id": ids[assay],
                },
            )
        )
    client.put(f"{API}/data-files/{ids['counts_1']}/samples/{ids['rna']}", json={"label": "c1"})
    client.put(f"{API}/data-files/{ids['counts_2']}/samples/{ids['other_rna']}", json={})
    return ids


def sample_assays(client: TestClient, sample_id: str) -> list[tuple[str, str | None, int]]:
    response = client.get(f"{API}/samples/{sample_id}/assays")
    assert response.status_code == 200, response.json()
    return [(a["assay_name"], a["label"], a["assay_wide_files"]) for a in response.json()]


def test_a_samples_assays_say_how_many_of_their_files_hold_all_their_samples(
    client: TestClient,
) -> None:
    ids = make_study(client)

    # Both of the plex's files hold the protein's data; each counts file has its own sample.
    assert sample_assays(client, ids["protein"]) == [("Plex-1", "TMT 126", 2)]
    assert sample_assays(client, ids["rna"]) == [("RNA-seq", None, 0)]
    files = client.get(f"{API}/samples/{ids['protein']}/data-files").json()
    assert files == []

    # Once a file has a sample of its own, it holds only its own samples' data.
    client.put(f"{API}/data-files/{ids['f01']}/samples/{ids['protein']}", json={})
    assert sample_assays(client, ids["protein"]) == [("Plex-1", "TMT 126", 1)]
    files = client.get(f"{API}/samples/{ids['protein']}/data-files").json()
    assert [file["name"] for file in files] == ["f01.raw"]


def test_a_subjects_assays_include_those_of_samples_derived_from_its_own(
    client: TestClient,
) -> None:
    ids = make_study(client)

    response = client.get(f"{API}/subjects/{ids['patient']}/assays")
    assert response.status_code == 200
    assert [
        (a["assay_name"], a["sample_name"], a["sample_id"], a["label"], a["assay_wide_files"])
        for a in response.json()
    ] == [
        ("Plex-1", "T-1-P", ids["protein"], "TMT 126", 2),
        ("RNA-seq", "T-1-R", ids["rna"], None, 0),
    ]
    other = client.get(f"{API}/subjects/{ids['other']}/assays").json()
    assert [(a["assay_name"], a["sample_name"]) for a in other] == [("RNA-seq", "T-2-R")]
    assert client.get(f"{API}/subjects/{ids['no_samples']}/assays").json() == []
    assert client.get(f"{API}/subjects/{UNKNOWN}/assays").status_code == 404


def test_a_subjects_data_files_are_those_its_samples_are_in(client: TestClient) -> None:
    ids = make_study(client)

    response = client.get(f"{API}/subjects/{ids['patient']}/data-files")
    assert response.status_code == 200
    files = response.json()
    assert [(f["name"], f["sample_name"], f["sample_id"], f["label"]) for f in files] == [
        ("counts-1.tsv", "T-1-R", ids["rna"], "c1")
    ]

    # A file with two of the subject's samples is listed once for each.
    client.put(f"{API}/data-files/{ids['f01']}/samples/{ids['protein']}", json={})
    client.put(f"{API}/data-files/{ids['f01']}/samples/{ids['tissue']}", json={})
    files = client.get(f"{API}/subjects/{ids['patient']}/data-files").json()
    assert [(f["name"], f["sample_name"]) for f in files] == [
        ("counts-1.tsv", "T-1-R"),
        ("f01.raw", "T-1"),
        ("f01.raw", "T-1-P"),
    ]
    assert client.get(f"{API}/subjects/{ids['no_samples']}/data-files").json() == []
    assert client.get(f"{API}/subjects/{UNKNOWN}/data-files").status_code == 404
