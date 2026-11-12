from __future__ import annotations

from app.api import health


def test_health_live(client) -> None:
    response = client.get("/health/live")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["status"] == "alive"


def test_health_ready(client, monkeypatch) -> None:
    async def fake_check_database_connection() -> bool:
        return True

    monkeypatch.setattr(health, "check_database_connection", fake_check_database_connection)
    response = client.get("/health/ready")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["status"] == "ready"
