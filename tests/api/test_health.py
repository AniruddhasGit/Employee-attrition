from unittest.mock import patch

from sqlalchemy.orm import Session


def test_health_ok_without_touching_the_database(client):
    """Render probes this every few seconds; it must not keep the free Neon compute awake."""
    with patch.object(Session, "execute", side_effect=AssertionError("health check hit the DB")):
        r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_deep_health_checks_the_database(client):
    body = client.get("/api/health", params={"deep": 1}).json()
    assert body["status"] == "ok" and body["db"] is True
