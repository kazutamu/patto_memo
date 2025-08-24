"""
Streamlined tests for main API endpoints.
"""

import pytest
from fastapi.testclient import TestClient

from main import app
from sse_manager import sse_manager


def test_health_check(client: TestClient):
    """Test that health check returns ok status."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "sse_connections" in data  # Check SSE connections field exists
    assert isinstance(data["sse_connections"], int)  # Should be an integer


@pytest.mark.parametrize(
    "endpoint,method,expected_status",
    [
        ("/api/v1/nonexistent", "GET", 404),
        ("/api/v1/llava/analyze", "GET", 405),  # POST only endpoint
        ("/invalid", "GET", 404),
    ],
)
def test_api_error_responses(client: TestClient, endpoint, method, expected_status):
    """Test API error handling for various invalid requests."""
    if method == "GET":
        response = client.get(endpoint)
    elif method == "POST":
        response = client.post(endpoint, json={})
    else:
        pytest.skip(f"Method {method} not implemented in test")

    assert response.status_code == expected_status


class TestSSEEndpoints:
    """Test Server-Sent Events endpoints."""

    def test_sse_connections_endpoint(self, client: TestClient):
        """Test the SSE connections status endpoint."""
        response = client.get("/api/v1/events/connections")
        assert response.status_code == 200
        data = response.json()
        assert "connection_count" in data
        assert "connected_clients" in data
        assert isinstance(data["connection_count"], int)
        assert isinstance(data["connected_clients"], list)

    def test_sse_stream_endpoint_exists(self, client: TestClient):
        """Test that SSE stream endpoint exists (basic connectivity test)."""
        # Skip this test as SSE endpoints are difficult to test with TestClient
        # The endpoint starts streaming and doesn't return immediately
        # SSE functionality is tested in the separate test_sse_manager.py file
        import pytest

        pytest.skip(
            "SSE streaming endpoints cannot be tested with synchronous TestClient"
        )


def test_get_queue_status(client: TestClient):
    """Test queue status endpoint returns expected structure."""
    response = client.get("/api/v1/queue/status")
    assert response.status_code == 200
    data = response.json()

    # Check expected fields exist
    required_fields = [
        "queue_size",
        "max_size",
        "drop_count",
        "total_frames",
        "message",
    ]
    for field in required_fields:
        assert field in data

    # Check data types
    assert isinstance(data["queue_size"], int)
    assert isinstance(data["max_size"], int)
    assert isinstance(data["drop_count"], int)
    assert isinstance(data["total_frames"], int)
    assert isinstance(data["message"], str)


def test_get_available_prompts(client: TestClient):
    """Test LLaVA prompts endpoint."""
    response = client.get("/api/v1/llava/prompts")
    assert response.status_code == 200
    data = response.json()

    # Should have info and example_prompts
    assert "info" in data
    assert "example_prompts" in data
    assert isinstance(data["example_prompts"], list)
    assert len(data["example_prompts"]) > 0
