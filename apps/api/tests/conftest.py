import base64
from io import BytesIO

import httpx
import pytest
from fastapi.testclient import TestClient
from httpx import AsyncClient

from main import app


@pytest.fixture
def client():
    """Create a test client for the FastAPI app."""
    return TestClient(app)


@pytest.fixture
def async_client():
    """Create an async test client for the FastAPI app."""
    return AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")






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
        "size": request.param,
    }


@pytest.fixture
def mock_ollama_responses():
    """Collection of mock Ollama responses for different scenarios."""
    return {
        "success": {
            "response": "This image shows a person walking through a doorway.",
            "done": True,
            "model": "llava:latest",
        },
        "error": {"error": "Model not found"},
        "malformed": {},  # Missing expected fields
        "empty_response": {"response": "", "done": True, "model": "llava:latest"},
    }


@pytest.fixture
def llava_request_data(image_data):
    """LLaVA analysis request data using parameterized image data."""
    return {
        "image_base64": image_data["base64"],
        "prompt": "Describe what you see in this image",
    }








@pytest.fixture(
    params=[
        ("test.jpg", b"fake_jpeg_data", "image/jpeg", "valid_jpeg"),
        ("test.png", b"fake_png_data", "image/png", "valid_png"),
        ("test.txt", b"text_content", "text/plain", "invalid_type"),
        ("empty.jpg", b"", "image/jpeg", "empty_file"),
    ]
)
def file_upload_data(request):
    """Parameterized file upload data for testing various scenarios."""
    filename, content, content_type, scenario = request.param
    return {
        "filename": filename,
        "content": content,
        "content_type": content_type,
        "scenario": scenario,
        "file_obj": BytesIO(content),
    }
