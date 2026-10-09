"""API-level tests: health, sessions, error shapes, rate limiting."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import _rate_limiter


def test_health(client: TestClient) -> None:
    resp = client.get("/api/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["llm_provider"] == "groq"
    assert isinstance(body["llm_configured"], bool)


def test_request_id_header_present(client: TestClient) -> None:
    resp = client.get("/api/health")
    assert "x-request-id" in {k.lower() for k in resp.headers}


def test_session_lifecycle(client: TestClient) -> None:
    sid = client.post("/api/sessions", json={"name": "demo"}).json()["session_id"]
    assert client.get(f"/api/sessions/{sid}").json()["name"] == "demo"
    assert client.delete(f"/api/sessions/{sid}").status_code == 204
    assert client.get(f"/api/sessions/{sid}").status_code == 404


def test_validation_error_shape(client: TestClient) -> None:
    resp = client.post("/api/sessions", json={"name": 12345})
    assert resp.status_code == 422
    error = resp.json()["error"]
    assert error["code"] == "request_validation"
    assert error["details"]


def test_rate_limit_returns_429(client: TestClient) -> None:
    original = _rate_limiter.per_minute
    try:
        _rate_limiter.per_minute = 2
        _rate_limiter._hits.clear()
        assert client.post("/api/sessions", json={}).status_code == 201
        assert client.post("/api/sessions", json={}).status_code == 201
        resp = client.post("/api/sessions", json={})
        assert resp.status_code == 429
        assert resp.json()["error"]["code"] == "rate_limited"
    finally:
        _rate_limiter.per_minute = original
        _rate_limiter._hits.clear()


def test_cors_allows_configured_origin(client: TestClient) -> None:
    resp = client.options(
        "/api/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert resp.headers.get("access-control-allow-origin") == "http://localhost:5173"
