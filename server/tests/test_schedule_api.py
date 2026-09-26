"""Integration tests for schedule booking / double-book prevention.

Requires a running Postgres with migrations + seed data applied
(same DATABASE_URL as server/.env).
"""

from __future__ import annotations

from datetime import date, timedelta

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


def _next_weekday(start: date | None = None) -> date:
    """Pick a weekday a few days out so seed data is unlikely to collide."""
    day = (start or date.today()) + timedelta(days=3)
    while day.isoweekday() > 5:  # skip Sat/Sun
        day += timedelta(days=1)
    return day


def test_double_booking_returns_409(auth_headers: dict[str, str]) -> None:
    on_date = _next_weekday()
    day = client.get(f"/api/v1/schedule/day?date={on_date.isoformat()}", headers=auth_headers)
    assert day.status_code == 200, day.text
    payload = day.json()

    open_slot = None
    therapist_id = None
    for column in payload["therapists"]:
        for slot in column["slots"]:
            if slot["state"] == "open":
                open_slot = slot
                therapist_id = column["id"]
                break
        if open_slot:
            break

    assert open_slot is not None, f"No open slots on {on_date}"
    assert therapist_id is not None

    patients = client.get("/api/v1/patients?page_size=1&status=active", headers=auth_headers)
    assert patients.status_code == 200
    items = patients.json()["items"]
    assert items, "Need at least one active patient in seed data"
    patient_id = items[0]["id"]

    body = {
        "patient_id": patient_id,
        "therapist_id": therapist_id,
        "appointment_date": on_date.isoformat(),
        "start_time": open_slot["start_time"][:5],
        "payment_method": "cash",
        "notes": "pytest double-book check",
    }

    first = client.post("/api/v1/appointments", json=body, headers=auth_headers)
    assert first.status_code == 201, first.text
    appointment_id = first.json()["id"]

    try:
        second = client.post("/api/v1/appointments", json=body, headers=auth_headers)
        assert second.status_code == 409, second.text
        assert "booked" in second.json()["detail"].lower()
    finally:
        cancel = client.post(
            f"/api/v1/appointments/{appointment_id}/cancel",
            headers=auth_headers,
        )
        assert cancel.status_code == 200, cancel.text


def test_booking_requires_auth() -> None:
    response = client.post(
        "/api/v1/appointments",
        json={
            "patient_id": 1,
            "therapist_id": 1,
            "appointment_date": date.today().isoformat(),
            "start_time": "09:00",
            "payment_method": "cash",
        },
    )
    assert response.status_code in (401, 403)
