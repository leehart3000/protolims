"""Tests for the API documentation endpoints."""

from fastapi.testclient import TestClient


def test_openapi_schema_is_served_under_api(client: TestClient) -> None:
    response = client.get("/api/openapi.json")
    assert response.status_code == 200
    assert response.json()["info"]["title"] == "ProtoLIMS API"


def test_swagger_page_is_served_under_api(client: TestClient) -> None:
    response = client.get("/api/docs")
    assert response.status_code == 200
    assert "swagger" in response.text.lower()


def test_swagger_page_loads_only_the_sites_own_files(client: TestClient) -> None:
    page = client.get("/api/docs").text
    assert '<script src="/swagger-ui/swagger-ui-bundle.js"></script>' in page
    assert '<script src="/swagger-ui-start.js"></script>' in page
    assert '<link rel="stylesheet" href="/swagger-ui/swagger-ui.css">' in page
    # Nothing from elsewhere, and no inline script, which the security policy would block.
    assert "https://" not in page
    assert "<script>" not in page


def test_old_documentation_paths_are_gone(client: TestClient) -> None:
    assert client.get("/docs").status_code == 404
    assert client.get("/redoc").status_code == 404
    assert client.get("/openapi.json").status_code == 404
