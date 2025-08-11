import base64
from io import BytesIO
from typing import Generator

import pytest
from fastapi.testclient import TestClient
from httpx import AsyncClient

from main import app, dummy_motion_events


@pytest.fixture
def client():
    """Create a test client for the FastAPI app."""
    return TestClient(app)


@pytest.fixture
def async_client():
    """Create an async test client for the FastAPI app."""
    return AsyncClient(app=app, base_url="http://test")


@pytest.fixture(params=[
    {"confidence": 0.85, "duration": 2.3, "description": "Test motion event"},
    {"confidence": 0.5, "duration": 1.0, "description": "Low confidence event"},
    {"confidence": 0.95, "duration": 5.0, "description": "High confidence event"}
])
def motion_event_data(request):
    """Parameterized motion event creation data for various test scenarios."""
    return request.param


@pytest.fixture
def sample_motion_settings():
    """Sample motion settings."""
    return {
        "detection_enabled": True,
        "sensitivity": 0.7,
        "min_confidence": 0.6,
        "recording_enabled": True,
        "alert_notifications": True,
    }


@pytest.fixture(params=["small", "large"])
def image_data(request):
    """Parameterized image data fixture for testing different sizes."""
    if request.param == "small":
        fake_data = b"fake_image_content_for_testing"
    else:  # large
        fake_data = b"x" * (100 * 1024)  # 100KB
    
    return {
        "raw": fake_data,
        "base64": base64.b64encode(fake_data).decode("utf-8"),
        "file": BytesIO(fake_data),
        "size": request.param
    }


@pytest.fixture
def mock_ollama_responses():
    """Collection of mock Ollama responses for different scenarios."""
    return {
        "success": {
            "response": "This image shows a person walking through a doorway.",
            "done": True,
            "model": "llava:latest"
        },
        "error": {
            "error": "Model not found"
        },
        "malformed": {},  # Missing expected fields
        "empty_response": {
            "response": "",
            "done": True,
            "model": "llava:latest"
        }
    }


@pytest.fixture
def llava_request_data(image_data):
    """LLaVA analysis request data using parameterized image data."""
    return {
        "image_base64": image_data["base64"],
        "prompt": "Describe what you see in this image"
    }


@pytest.fixture(autouse=True)
def reset_dummy_data():
    """Reset dummy motion events data before each test."""
    original_events = dummy_motion_events.copy()
    yield
    dummy_motion_events.clear()
    dummy_motion_events.extend(original_events)


@pytest.fixture(params=[
    # Invalid data scenarios for validation testing
    ({"confidence": "invalid", "duration": 2.0}, "Invalid confidence type"),
    ({"confidence": 0.8}, "Missing duration"),
    ({"duration": 1.5}, "Missing confidence"),
    ({"confidence": 0.8, "duration": "invalid"}, "Invalid duration type"),
    ({}, "Empty data"),
    ({"confidence": None, "duration": None}, "Null values")
])
def invalid_motion_data(request):
    """Parameterized invalid motion event data for validation testing."""
    return request.param


@pytest.fixture(params=[
    # Edge case scenarios
    ({"confidence": 0.0, "duration": 0.0, "description": "Zero values"}, "zero"),
    ({"confidence": 1.0, "duration": 999.99, "description": "Large values"}, "large"),
    ({"confidence": -0.1, "duration": -1.0, "description": "Negative values"}, "negative"),
    ({"confidence": 0.999999, "duration": 1.0, "description": "High precision"}, "precision")
])
def edge_case_motion_data(request):
    """Parameterized edge case motion event data for boundary testing."""
    return request.param


@pytest.fixture(params=[
    ("test.jpg", b"fake_jpeg_data", "image/jpeg", "valid_jpeg"),
    ("test.png", b"fake_png_data", "image/png", "valid_png"),
    ("test.txt", b"text_content", "text/plain", "invalid_type"),
    ("empty.jpg", b"", "image/jpeg", "empty_file")
])
def file_upload_data(request):
    """Parameterized file upload data for testing various scenarios."""
    filename, content, content_type, scenario = request.param
    return {
        "filename": filename,
        "content": content,
        "content_type": content_type,
        "scenario": scenario,
        "file_obj": BytesIO(content)
    }
