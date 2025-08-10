import pytest
from fastapi.testclient import TestClient

from main import app, dummy_motion_events


class TestHealthEndpoint:
    """Test the health check endpoint."""

    def test_health_check(self, client: TestClient):
        """Test that health check returns ok status."""
        response = client.get("/health")

        assert response.status_code == 200
        assert response.json() == {"status": "ok"}


class TestMotionEventsEndpoints:
    """Test motion events CRUD endpoints."""

    def test_get_motion_events_default(self, client: TestClient):
        """Test getting motion events with default limit."""
        response = client.get("/api/v1/motion/events")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) <= 10  # Default limit

        # Check structure of first event if any exist
        if data:
            event = data[0]
            assert "id" in event
            assert "timestamp" in event
            assert "confidence" in event
            assert "duration" in event
            assert "description" in event

    def test_get_motion_events_with_limit(self, client: TestClient):
        """Test getting motion events with custom limit."""
        response = client.get("/api/v1/motion/events?limit=2")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) <= 2

    def test_get_motion_events_limit_zero(self, client: TestClient):
        """Test getting motion events with zero limit."""
        response = client.get("/api/v1/motion/events?limit=0")

        assert response.status_code == 200
        data = response.json()
        assert data == []

    def test_create_motion_event_valid(
        self, client: TestClient, sample_motion_event_create
    ):
        """Test creating a valid motion event."""
        initial_count = len(dummy_motion_events)

        response = client.post("/api/v1/motion/events", json=sample_motion_event_create)

        assert response.status_code == 200
        data = response.json()

        # Check response structure
        assert "id" in data
        assert "timestamp" in data
        assert data["confidence"] == sample_motion_event_create["confidence"]
        assert data["duration"] == sample_motion_event_create["duration"]
        assert data["description"] == sample_motion_event_create["description"]

        # Verify it was added to the dummy data
        assert len(dummy_motion_events) == initial_count + 1

    def test_create_motion_event_minimal(self, client: TestClient):
        """Test creating a motion event with minimal required fields."""
        event_data = {"confidence": 0.75, "duration": 1.5}

        response = client.post("/api/v1/motion/events", json=event_data)

        assert response.status_code == 200
        data = response.json()
        assert data["confidence"] == 0.75
        assert data["duration"] == 1.5
        assert data["description"] == ""  # Default empty string

    def test_create_motion_event_invalid_confidence(self, client: TestClient):
        """Test creating motion event with invalid confidence value."""
        event_data = {
            "confidence": "invalid",  # Should be float
            "duration": 1.5,
            "description": "Test event",
        }

        response = client.post("/api/v1/motion/events", json=event_data)
        assert response.status_code == 422  # Validation error

    def test_create_motion_event_missing_required_field(self, client: TestClient):
        """Test creating motion event with missing required field."""
        event_data = {
            "confidence": 0.8
            # Missing duration
        }

        response = client.post("/api/v1/motion/events", json=event_data)
        assert response.status_code == 422  # Validation error

    def test_create_motion_event_negative_values(self, client: TestClient):
        """Test creating motion event with negative values."""
        event_data = {
            "confidence": -0.1,
            "duration": -1.0,
            "description": "Negative test",
        }

        # The API currently doesn't validate ranges, so this will succeed
        # In a real application, you might want to add validation
        response = client.post("/api/v1/motion/events", json=event_data)
        assert response.status_code == 200

    def test_create_motion_event_with_empty_description(self, client: TestClient):
        """Test creating motion event with empty description."""
        event_data = {"confidence": 0.8, "duration": 2.0, "description": ""}

        response = client.post("/api/v1/motion/events", json=event_data)
        assert response.status_code == 200
        data = response.json()
        assert data["description"] == ""


class TestMotionSettingsEndpoint:
    """Test motion settings endpoint."""

    def test_get_motion_settings(self, client: TestClient):
        """Test getting motion settings."""
        response = client.get("/api/v1/motion/settings")

        assert response.status_code == 200
        data = response.json()

        # Check structure
        expected_fields = [
            "detection_enabled",
            "sensitivity",
            "min_confidence",
            "recording_enabled",
            "alert_notifications",
        ]

        for field in expected_fields:
            assert field in data

        # Check types
        assert isinstance(data["detection_enabled"], bool)
        assert isinstance(data["sensitivity"], (int, float))
        assert isinstance(data["min_confidence"], (int, float))
        assert isinstance(data["recording_enabled"], bool)
        assert isinstance(data["alert_notifications"], bool)

        # Check reasonable values
        assert 0 <= data["sensitivity"] <= 1
        assert 0 <= data["min_confidence"] <= 1


class TestDataValidation:
    """Test Pydantic model validation."""

    def test_motion_event_create_model(self, sample_motion_event_create):
        """Test MotionEventCreate model validation."""
        from main import MotionEventCreate

        event = MotionEventCreate(**sample_motion_event_create)
        assert event.confidence == sample_motion_event_create["confidence"]
        assert event.duration == sample_motion_event_create["duration"]
        assert event.description == sample_motion_event_create["description"]

    def test_motion_event_create_default_description(self):
        """Test MotionEventCreate with default description."""
        from main import MotionEventCreate

        event = MotionEventCreate(confidence=0.8, duration=1.5)
        assert event.description == ""

    def test_motion_event_model(self, sample_motion_event):
        """Test MotionEvent model validation."""
        from main import MotionEvent

        event = MotionEvent(**sample_motion_event)
        assert event.id == sample_motion_event["id"]
        assert event.timestamp == sample_motion_event["timestamp"]
        assert event.confidence == sample_motion_event["confidence"]
        assert event.duration == sample_motion_event["duration"]
        assert event.description == sample_motion_event["description"]

    def test_motion_settings_model(self, sample_motion_settings):
        """Test MotionSettings model validation."""
        from main import MotionSettings

        settings = MotionSettings(**sample_motion_settings)
        assert settings.detection_enabled == sample_motion_settings["detection_enabled"]
        assert settings.sensitivity == sample_motion_settings["sensitivity"]
        assert settings.min_confidence == sample_motion_settings["min_confidence"]
        assert settings.recording_enabled == sample_motion_settings["recording_enabled"]
        assert (
            settings.alert_notifications
            == sample_motion_settings["alert_notifications"]
        )


class TestEndToEnd:
    """End-to-end integration tests."""

    def test_full_workflow(self, client: TestClient):
        """Test complete workflow: get settings, create event, get events."""
        # 1. Get settings first
        settings_response = client.get("/api/v1/motion/settings")
        assert settings_response.status_code == 200
        settings = settings_response.json()

        # 2. Create a motion event
        event_data = {
            "confidence": settings["min_confidence"] + 0.1,  # Above minimum
            "duration": 2.0,
            "description": "End-to-end test event",
        }

        create_response = client.post("/api/v1/motion/events", json=event_data)
        assert create_response.status_code == 200
        created_event = create_response.json()

        # 3. Get events and verify our event is there
        events_response = client.get("/api/v1/motion/events")
        assert events_response.status_code == 200
        events = events_response.json()

        # Find our created event
        our_event = next((e for e in events if e["id"] == created_event["id"]), None)
        assert our_event is not None
        assert our_event["description"] == "End-to-end test event"

    def test_api_cors_headers_not_configured(self, client: TestClient):
        """Test that CORS is not configured (would need to be added for production)."""
        response = client.get("/health")
        # In a real application, you'd want CORS headers for frontend access
        assert "access-control-allow-origin" not in response.headers


class TestErrorHandling:
    """Test error handling scenarios."""

    def test_nonexistent_endpoint(self, client: TestClient):
        """Test accessing non-existent endpoint."""
        response = client.get("/api/v1/nonexistent")
        assert response.status_code == 404

    def test_invalid_http_method(self, client: TestClient):
        """Test using invalid HTTP method on existing endpoint."""
        response = client.delete("/api/v1/motion/events")
        assert response.status_code == 405  # Method not allowed

    def test_malformed_json(self, client: TestClient):
        """Test sending malformed JSON."""
        response = client.post(
            "/api/v1/motion/events",
            data="invalid json",
            headers={"content-type": "application/json"},
        )
        assert response.status_code == 422


class TestPerformance:
    """Basic performance and load tests."""

    def test_multiple_event_creation(self, client: TestClient):
        """Test creating multiple events in succession."""
        initial_count = len(dummy_motion_events)
        events_to_create = 5

        for i in range(events_to_create):
            event_data = {
                "confidence": 0.7 + (i * 0.05),
                "duration": 1.0 + (i * 0.1),
                "description": f"Performance test event {i}",
            }

            response = client.post("/api/v1/motion/events", json=event_data)
            assert response.status_code == 200

        # Verify all events were created
        assert len(dummy_motion_events) == initial_count + events_to_create

    def test_large_limit_parameter(self, client: TestClient):
        """Test getting events with very large limit."""
        response = client.get("/api/v1/motion/events?limit=1000")
        assert response.status_code == 200
        # Should not crash or timeout
