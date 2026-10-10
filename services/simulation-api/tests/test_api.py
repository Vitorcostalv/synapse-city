from fastapi.testclient import TestClient

from app.main import app, sessions

client = TestClient(app)


def test_health_and_readiness():
    assert client.get("/health").json()["status"] == "ok"
    assert client.get("/ready").json()["ready"] is True


def test_sessions_are_isolated_and_validated():
    sessions.clear()
    first = client.post("/simulation/start", json={"seed": 10, "population": 20})
    second = client.post("/simulation/start", json={"seed": 11, "population": 21})
    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["sessionId"] != second.json()["sessionId"]
    assert client.get(f"/simulation/{first.json()['sessionId']}").json()["seed"] == 10
    assert client.post("/simulation/start", json={"seed": 0, "population": 999}).status_code == 422


def test_unknown_session_is_not_exposed():
    assert client.get("/simulation/not-a-session").status_code == 404
