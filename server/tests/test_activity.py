"""Activity log list API smoke tests.

Requires a running Postgres with migrations + seed data applied
(same DATABASE_URL as server/.env).
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


@pytest.fixture(scope="module")
def auth_headers() -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@physiodesk.com", "password": "Admin123!"},
    )
    assert response.status_code == 200, response.text
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_list_activity_requires_auth() -> None:
    response = client.get("/api/v1/activity")
    assert response.status_code in (401, 403)


def test_list_activity(auth_headers: dict[str, str]) -> None:
    response = client.get("/api/v1/activity?page_size=10", headers=auth_headers)
    assert response.status_code == 200, response.text
    body = response.json()
    assert "items" in body
    assert "total" in body
    assert isinstance(body["items"], list)
    if body["items"]:
        row = body["items"][0]
        assert "action" in row
        assert "summary" in row
        assert "created_at" in row


def test_list_activity_entity_filter(auth_headers: dict[str, str]) -> None:
    response = client.get(
        "/api/v1/activity?entity_type=patient&page_size=20",
        headers=auth_headers,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    for row in body["items"]:
        assert row["entity_type"] == "patient"
