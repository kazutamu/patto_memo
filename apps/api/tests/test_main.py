"""
Streamlined tests for main API endpoints.
Consolidated from multiple redundant test classes with parameterized tests.
"""

import pytest
from fastapi.testclient import TestClient

from main import app, dummy_motion_events


def test_health_check(client: TestClient):
    """Test that health check returns ok status."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


class TestMotionEventsAPI:
    """Consolidated tests for motion events endpoints."""

    @pytest.mark.parametrize("limit,expected_behavior", [
        (None, "default_limit"),       # Default limit
        (2, "custom_limit"),          # Custom limit
        (0, "zero_limit"),            # Zero limit
        (100, "large_limit"),         # Large limit
        (-1, "validation_error")      # Invalid limit
    ])
    def test_get_motion_events_with_limits(self, client: TestClient, limit, expected_behavior):
        """Test getting motion events with various limit parameters."""
        url = "/api/v1/motion/events"
        if limit is not None:
            url += f"?limit={limit}"
        
        response = client.get(url)
        
        if expected_behavior == "validation_error":
            assert response.status_code == 422
            return
            
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        if expected_behavior == "zero_limit":
            assert data == []
        elif expected_behavior == "custom_limit":
            assert len(data) <= limit
        else:  # default or large limit
            assert len(data) <= (limit or 10)
        
        # Validate structure if events exist
        if data:
            event = data[0]
            required_fields = ["id", "timestamp", "confidence", "duration", "description"]
            assert all(field in event for field in required_fields)
            
            # Validate data types
            assert isinstance(event["id"], int)
            assert isinstance(event["timestamp"], str)
            assert isinstance(event["confidence"], (int, float))
            assert isinstance(event["duration"], (int, float))
            assert isinstance(event["description"], str)

    def test_create_motion_event_valid(self, client: TestClient, motion_event_data):
        """Test creating valid motion events with various data."""
        initial_count = len(dummy_motion_events)
        response = client.post("/api/v1/motion/events", json=motion_event_data)

        assert response.status_code == 200
        data = response.json()

        # Check response structure
        required_fields = ["id", "timestamp", "confidence", "duration", "description"]
        assert all(field in data for field in required_fields)
        assert data["confidence"] == motion_event_data["confidence"]
        assert data["duration"] == motion_event_data["duration"]
        assert data["description"] == motion_event_data["description"]

        # Verify it was added to the dummy data
        assert len(dummy_motion_events) == initial_count + 1

    def test_create_motion_event_minimal_fields(self, client: TestClient):
        """Test creating motion event with minimal required fields."""
        event_data = {"confidence": 0.75, "duration": 1.5}
        response = client.post("/api/v1/motion/events", json=event_data)

        assert response.status_code == 200
        data = response.json()
        assert data["confidence"] == 0.75
        assert data["duration"] == 1.5
        assert data["description"] == ""  # Default empty string

    def test_create_motion_event_validation_errors(self, client: TestClient, invalid_motion_data):
        """Test creating motion events with various invalid data scenarios."""
        invalid_data, description = invalid_motion_data
        response = client.post("/api/v1/motion/events", json=invalid_data)
        assert response.status_code == 422  # Validation error

    def test_create_motion_event_edge_cases(self, client: TestClient, edge_case_motion_data):
        """Test creating motion events with edge case values."""
        event_data, case_type = edge_case_motion_data
        response = client.post("/api/v1/motion/events", json=event_data)
        assert response.status_code == 200
        
        data = response.json()
        if case_type == "precision":
            assert abs(data["confidence"] - event_data["confidence"]) < 1e-10
        else:
            assert data["confidence"] == event_data["confidence"]

    @pytest.mark.parametrize("description,expected", [
        ("", ""),  # Empty description
        ("Very long description " * 1000, "Very long description " * 1000),  # Long description
        ("测试 Unicode 🔍", "测试 Unicode 🔍"),  # Unicode characters
    ])
    def test_create_motion_event_description_handling(self, client: TestClient, description, expected):
        """Test motion event creation with various description formats."""
        event_data = {"confidence": 0.8, "duration": 1.5, "description": description}
        response = client.post("/api/v1/motion/events", json=event_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["description"] == expected


def test_get_motion_settings(client: TestClient):
    """Test motion settings endpoint structure and validation."""
    response = client.get("/api/v1/motion/settings")
    assert response.status_code == 200
    data = response.json()

    # Check structure and types
    expected_fields = {
        "detection_enabled": bool,
        "sensitivity": (int, float),
        "min_confidence": (int, float),
        "recording_enabled": bool,
        "alert_notifications": bool,
    }

    for field, expected_type in expected_fields.items():
        assert field in data
        assert isinstance(data[field], expected_type)

    # Check reasonable value ranges
    assert 0 <= data["sensitivity"] <= 1
    assert 0 <= data["min_confidence"] <= 1


def test_basic_workflow_integration(client: TestClient):
    """Test basic workflow: get settings, create event, verify creation."""
    # Get settings
    settings_response = client.get("/api/v1/motion/settings")
    assert settings_response.status_code == 200
    settings = settings_response.json()

    # Create event above minimum confidence
    event_data = {
        "confidence": settings["min_confidence"] + 0.1,
        "duration": 2.0,
        "description": "Integration test event",
    }

    create_response = client.post("/api/v1/motion/events", json=event_data)
    assert create_response.status_code == 200
    created_event = create_response.json()

    # Verify event exists in list
    events_response = client.get("/api/v1/motion/events")
    assert events_response.status_code == 200
    events = events_response.json()

    our_event = next((e for e in events if e["id"] == created_event["id"]), None)
    assert our_event is not None
    assert our_event["description"] == "Integration test event"


@pytest.mark.parametrize("endpoint,method,expected_status", [
    ("/api/v1/nonexistent", "GET", 404),  # Non-existent endpoint
    ("/api/v1/motion/events", "DELETE", 405),  # Invalid method
])
def test_api_error_responses(client: TestClient, endpoint, method, expected_status):
    """Test various API error conditions."""
    response = getattr(client, method.lower())(endpoint)
    assert response.status_code == expected_status


@pytest.mark.parametrize("payload,content_type,expected_status_codes", [
    ("invalid json", "application/json", [422]),  # Malformed JSON
    ('{"confidence": 0.8, "duration": 1.5}', None, [200, 422, 415]),  # Missing content-type
    ('{"confidence": 0.8, "duration": 1.5}', "text/plain", [422, 415]),  # Wrong content-type
])
def test_request_format_handling(client: TestClient, payload, content_type, expected_status_codes):
    """Test handling of various request formats and content types."""
    headers = {"content-type": content_type} if content_type else {}
    response = client.post("/api/v1/motion/events", data=payload, headers=headers)
    assert response.status_code in expected_status_codes


@pytest.mark.parametrize("test_data,description", [
    ({"confidence": None, "duration": 1.5}, "null_confidence"),
    ({"confidence": 0.8, "duration": 1.5, "description": "测试 Unicode 🔍"}, "unicode_chars"),
    ({"confidence": 0.8, "duration": 1.5, "description": '"malicious"'}, "injection_attempt"),
])
def test_data_handling_edge_cases(client: TestClient, test_data, description):
    """Test handling of edge cases in request data."""
    response = client.post("/api/v1/motion/events", json=test_data)
    
    if description == "null_confidence":
        assert response.status_code == 422  # Validation error
    else:
        assert response.status_code == 200
        if description == "unicode_chars":
            data = response.json()
            assert "测试 Unicode 🔍" in data["description"]
        elif description == "injection_attempt":
            data = response.json()
            assert '"malicious"' in data["description"]  # Treated as plain text


def test_bulk_event_creation_performance(client: TestClient):
    """Test creating multiple events in succession for basic performance check."""
    initial_count = len(dummy_motion_events)
    events_to_create = 10

    for i in range(events_to_create):
        event_data = {
            "confidence": 0.7 + (i * 0.02),
            "duration": 1.0 + (i * 0.1),
            "description": f"Bulk test event {i}",
        }
        response = client.post("/api/v1/motion/events", json=event_data)
        assert response.status_code == 200

    # Verify all events were created
    assert len(dummy_motion_events) == initial_count + events_to_create