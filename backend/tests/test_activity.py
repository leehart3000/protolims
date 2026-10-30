"""Tests of someone's own activity: the changes they've made, from the audit trail."""

from typing import Any

from fastapi.testclient import TestClient
from helpers import ALICE, API, DAVE, PROJECT, STUDY, SignIn, make_records

ACTIVITY = f"{API}/auth/me/activity"


def summary(item: dict[str, Any]) -> tuple[Any, ...]:
    """The parts of an activity item that don't vary between test runs."""
    return (
        item["action"],
        item["entity_type"],
        item["name"],
        item["project_code"],
        item["study_code"],
        item["person"],
        item["role"],
    )


def test_me_says_when_someone_joined_and_last_signed_in(
    client: TestClient, sign_in_as: SignIn
) -> None:
    user = client.get(f"{API}/auth/me", headers=sign_in_as(ALICE)).json()["user"]
    assert user["subject"] == ALICE
    assert user["created_at"] is not None
    assert user["last_signed_in_at"] is not None


def test_activity_needs_signing_in(anonymous: TestClient) -> None:
    response = anonymous.get(ACTIVITY)
    assert (response.status_code, response.json()) == (401, {"detail": "Please sign in to do this"})


def test_activity_lists_someones_changes_newest_first(client: TestClient) -> None:
    make_records(client)
    assert client.put(f"{PROJECT}/members/{DAVE}", json={"role": "viewer"}).status_code == 200
    assert client.delete(f"{PROJECT}/members/{DAVE}").status_code == 204
    assert client.delete(f"{API}/users/{DAVE}").status_code == 204

    page = client.get(ACTIVITY, params={"limit": 100}).json()
    assert page["total"] == 11
    assert [summary(item) for item in page["items"]] == [
        ("remove_user", "user", None, None, None, DAVE, None),
        ("remove_member", "project", "P1", "P1", None, DAVE, None),
        ("set_member", "project", "P1", "P1", None, DAVE, "viewer"),
        ("create", "data_file", "b.bam", "P1", "S1", None, None),
        ("create", "data_file", "a.bam", "P1", "S1", None, None),
        ("create", "assay", "Run-1", "P1", "S1", None, None),
        ("create", "sample", "T-1", "P1", "S1", None, None),
        ("create", "subject", "P-1", "P1", "S1", None, None),
        ("create", "study", "S2", "P1", "S2", None, None),
        ("create", "study", "S1", "P1", "S1", None, None),
        ("create", "project", "P1", "P1", None, None, None),
    ]

    # A page at a time.
    second = client.get(ACTIVITY, params={"limit": 2, "offset": 2}).json()
    assert second["total"] == 11
    assert [summary(item) for item in second["items"]] == [
        summary(item) for item in page["items"][2:4]
    ]


def test_activity_only_lists_the_persons_own_changes(
    client: TestClient, sign_in_as: SignIn
) -> None:
    make_records(client)
    alice = sign_in_as(ALICE)
    assert client.get(ACTIVITY, headers=alice).json() == {"items": [], "total": 0}


def test_activity_hides_what_someone_can_no_longer_see(
    client: TestClient, sign_in_as: SignIn, private: None
) -> None:
    make_records(client)
    client.put(f"{STUDY}/members/{ALICE}", json={"role": "editor"})
    alice = sign_in_as(ALICE)
    subject = {"name": "A-1", "subject_type": "patient"}
    assert client.post(f"{STUDY}/subjects", json=subject, headers=alice).status_code == 201

    [item] = client.get(ACTIVITY, headers=alice).json()["items"]
    assert summary(item) == ("create", "subject", "A-1", "P1", "S1", None, None)

    # Once her role is taken away, she can still see that she made a change, but not to what.
    client.delete(f"{STUDY}/members/{ALICE}")
    [item] = client.get(ACTIVITY, headers=alice).json()["items"]
    assert summary(item) == ("create", "subject", None, None, None, None, None)
