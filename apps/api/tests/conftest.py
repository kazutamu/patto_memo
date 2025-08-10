import pytest
from fastapi.testclient import TestClient
from main import app


@pytest.fixture
def client():
    """Create a test client for the FastAPI app."""
    return TestClient(app)


@pytest.fixture
def sample_motion_event_create():
    """Sample motion event creation data."""
    return {
        "confidence": 0.85,
        "duration": 2.3,
        "description": "Test motion event"
    }


@pytest.fixture
def sample_motion_event():
    """Sample complete motion event."""
    return {
        "id": 1,
        "timestamp": "2025-08-10T10:30:00Z",
        "confidence": 0.85,
        "duration": 2.3,
        "description": "Test motion event"
    }


@pytest.fixture
def sample_motion_settings():
    """Sample motion settings."""
    return {
        "detection_enabled": True,
        "sensitivity": 0.7,
        "min_confidence": 0.6,
        "recording_enabled": True,
        "alert_notifications": True
    }