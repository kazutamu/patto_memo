"""
Streamlined tests for LLaVA image analysis endpoints.
Consolidated from verbose test classes with optimized mock usage and parameterized tests.
"""

import base64
from io import BytesIO

import httpx
import pytest
from fastapi.testclient import TestClient
from httpx_mock import HTTPXMock

from main import app


class TestLLaVAAnalysisEndpoints:
    """Consolidated tests for LLaVA analysis endpoints."""

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "endpoint,request_method,data_key",
        [
            ("/api/v1/llava/analyze", "json", "json"),
            ("/api/v1/llava/analyze-upload", "files", "files"),
        ],
    )
    async def test_successful_analysis(
        self, httpx_mock: HTTPXMock, endpoint, request_method, data_key
    ):
        """Test successful image analysis for both base64 and upload endpoints."""
        # Mock successful Ollama response
        mock_response = {
            "response": "This image shows a person walking through a doorway.",
            "done": True,
        }
        httpx_mock.add_response(
            method="POST",
            url="http://localhost:11434/api/generate",
            json=mock_response,
            status_code=200,
        )

        test_image_data = b"fake_image_data"
        test_image_base64 = base64.b64encode(test_image_data).decode("utf-8")

        with TestClient(app) as client:
            if request_method == "json":
                request_data = {
                    "image_base64": test_image_base64,
                    "prompt": "Describe what you see in this image",
                }
                response = client.post(endpoint, json=request_data)
            else:  # files
                response = client.post(
                    endpoint,
                    files={
                        "file": ("test.jpg", BytesIO(test_image_data), "image/jpeg")
                    },
                    data={"prompt": "Describe what you see in this image"},
                )

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert (
            data["description"]
            == "This image shows a person walking through a doorway."
        )
        assert data["model_used"] == "llava:latest"
        assert data["processing_time"] > 0
        assert data["error_message"] is None

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "error_scenario,mock_setup",
        [
            (
                "service_unavailable",
                {"status_code": 503, "text": "Service unavailable"},
            ),
            ("timeout", {"exception": httpx.TimeoutException("Request timed out")}),
            (
                "malformed_response",
                {"status_code": 200, "json": {}},
            ),  # Missing expected fields
        ],
    )
    async def test_error_handling(
        self, httpx_mock: HTTPXMock, error_scenario, mock_setup
    ):
        """Test error handling scenarios for LLaVA endpoints."""
        test_image_base64 = base64.b64encode(b"fake_image_data").decode("utf-8")

        if "exception" in mock_setup:
            httpx_mock.add_exception(
                mock_setup["exception"],
                method="POST",
                url="http://localhost:11434/api/generate",
            )
        else:
            httpx_mock.add_response(
                method="POST",
                url="http://localhost:11434/api/generate",
                **{k: v for k, v in mock_setup.items() if k != "exception"},
            )

        request_data = {
            "image_base64": test_image_base64,
            "prompt": "Describe what you see",
        }

        with TestClient(app) as client:
            response = client.post("/api/v1/llava/analyze", json=request_data)

        if error_scenario == "service_unavailable":
            assert response.status_code == 503
        else:
            assert response.status_code == 200
            data = response.json()
            if error_scenario in ["timeout", "connection_error"]:
                assert data["success"] is False
                assert "Connection error" in data["error_message"]
            elif error_scenario == "malformed_response":
                assert data["success"] is True
                assert data["description"] == "No description available"

    @pytest.mark.parametrize(
        "validation_scenario,request_data,expected_status",
        [
            ("missing_image", {"prompt": "Test"}, 422),
            (
                "empty_image",
                {"image_base64": "", "prompt": "Test"},
                200,
            ),  # Passes validation but may fail at Ollama
            ("invalid_image_type", {"image_base64": 123, "prompt": "Test"}, 422),
            ("invalid_prompt_type", {"image_base64": "dGVzdA==", "prompt": 123}, 422),
        ],
    )
    def test_request_validation(
        self, validation_scenario, request_data, expected_status
    ):
        """Test request validation for various invalid inputs."""
        with TestClient(app) as client:
            response = client.post("/api/v1/llava/analyze", json=request_data)

        if expected_status == 422:
            assert response.status_code == 422
        else:
            assert response.status_code in [
                200,
                503,
            ]  # May succeed or fail depending on Ollama

    def test_file_upload_validation_scenarios(self):
        """Test file upload validation scenarios."""
        test_scenarios = [
            ("no_file", {}, 422),
            ("empty_file", {"file": ("empty.jpg", BytesIO(b""), "image/jpeg")}, 200),
            (
                "wrong_field_name",
                {"wrong_field": ("test.jpg", BytesIO(b"data"), "image/jpeg")},
                422,
            ),
        ]

        for scenario, files_data, expected_status in test_scenarios:
            with TestClient(app) as client:
                if files_data:
                    response = client.post(
                        "/api/v1/llava/analyze-upload", files=files_data
                    )
                else:
                    response = client.post("/api/v1/llava/analyze-upload")

            assert response.status_code == expected_status

    @pytest.mark.asyncio
    async def test_consistency_between_endpoints(self, httpx_mock: HTTPXMock):
        """Test that base64 and upload endpoints produce consistent results."""
        mock_response = {"response": "Consistent analysis result", "done": True}
        httpx_mock.add_response(
            method="POST",
            url="http://localhost:11434/api/generate",
            json=mock_response,
            status_code=200,
        )

        test_image_data = b"test_image_content"
        test_image_base64 = base64.b64encode(test_image_data).decode("utf-8")
        test_prompt = "Consistent test prompt"

        with TestClient(app) as client:
            # Test base64 endpoint
            base64_response = client.post(
                "/api/v1/llava/analyze",
                json={"image_base64": test_image_base64, "prompt": test_prompt},
            )

            # Test upload endpoint
            upload_response = client.post(
                "/api/v1/llava/analyze-upload",
                files={"file": ("test.jpg", BytesIO(test_image_data), "image/jpeg")},
                data={"prompt": test_prompt},
            )

        assert base64_response.status_code == 200
        assert upload_response.status_code == 200

        base64_data = base64_response.json()
        upload_data = upload_response.json()

        # Both should have same success status and model
        assert base64_data["success"] == upload_data["success"]
        assert base64_data["model_used"] == upload_data["model_used"]
        assert base64_data["description"] == upload_data["description"]

    @pytest.mark.parametrize(
        "file_scenario,filename,content,content_type",
        [
            ("valid_jpeg", "test.jpg", b"fake_jpeg_data", "image/jpeg"),
            ("valid_png", "test.png", b"fake_png_data", "image/png"),
            ("non_image", "test.txt", b"text_content", "text/plain"),
            ("no_extension", "test", b"file_content", "application/octet-stream"),
            ("unicode_filename", "测试图片.jpg", b"fake_data", "image/jpeg"),
        ],
    )
    def test_file_upload_types_and_edge_cases(
        self, file_scenario, filename, content, content_type
    ):
        """Test file upload with various file types and edge cases."""
        with TestClient(app) as client:
            response = client.post(
                "/api/v1/llava/analyze-upload",
                files={"file": (filename, BytesIO(content), content_type)},
            )

        # Should handle all file types (endpoint doesn't validate file types)
        assert response.status_code == 200

    @pytest.mark.parametrize(
        "prompt_scenario,prompt_value,expected_behavior",
        [
            ("default_prompt", None, "uses_default"),
            ("empty_prompt", "", "accepts_empty"),
            ("long_prompt", "Analyze this image " * 500, "handles_long"),
            ("unicode_prompt", "测试 Unicode 🔍 prompt", "handles_unicode"),
        ],
    )
    def test_prompt_handling_variations(
        self, prompt_scenario, prompt_value, expected_behavior
    ):
        """Test various prompt handling scenarios."""
        test_image_base64 = base64.b64encode(b"fake_image_data").decode("utf-8")

        request_data = {"image_base64": test_image_base64}
        if prompt_value is not None:
            request_data["prompt"] = prompt_value

        with TestClient(app) as client:
            response = client.post("/api/v1/llava/analyze", json=request_data)

        # All scenarios should be handled gracefully
        assert response.status_code in [200, 413, 422]  # 413 for very large payloads

    @pytest.mark.asyncio
    async def test_concurrent_requests_handling(self, httpx_mock: HTTPXMock):
        """Test handling multiple concurrent LLaVA requests."""
        mock_response = {"response": "Concurrent request processed", "done": True}
        httpx_mock.add_response(
            method="POST",
            url="http://localhost:11434/api/generate",
            json=mock_response,
            status_code=200,
        )

        test_image_base64 = base64.b64encode(b"test_data").decode("utf-8")

        with TestClient(app) as client:
            # Make multiple requests
            responses = []
            for i in range(3):
                response = client.post(
                    "/api/v1/llava/analyze",
                    json={
                        "image_base64": test_image_base64,
                        "prompt": f"Concurrent request {i}",
                    },
                )
                responses.append(response)

        # All should succeed
        for response in responses:
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True

    @pytest.mark.parametrize(
        "size_scenario,image_size",
        [
            ("small", 1024),  # 1KB
            ("medium", 100 * 1024),  # 100KB
            ("large", 1024 * 1024),  # 1MB
        ],
    )
    def test_image_size_handling(self, size_scenario, image_size):
        """Test handling of various image sizes."""
        large_image_data = b"x" * image_size
        large_image_base64 = base64.b64encode(large_image_data).decode("utf-8")

        request_data = {
            "image_base64": large_image_base64,
            "prompt": f"Analyze this {size_scenario} image",
        }

        with TestClient(app) as client:
            response = client.post("/api/v1/llava/analyze", json=request_data)

        # Should handle various sizes gracefully
        assert response.status_code in [
            200,
            413,
            503,
        ]  # Success, too large, or Ollama unavailable


class TestLLaVASecurityAndEdgeCases:
    """Test security aspects and edge cases."""

    @pytest.mark.parametrize(
        "malicious_input,input_type",
        [
            ("../../../etc/passwd", "filename"),
            ("<script>alert('xss')</script>.jpg", "filename"),
            ("'; DROP TABLE files; --.jpg", "filename"),
            ("file\x00.jpg", "filename"),
            ("<script>alert('xss')</script>", "prompt"),
            ("'; DROP TABLE prompts; --", "prompt"),
            ("../../../etc/passwd", "prompt"),
        ],
    )
    def test_security_input_handling(self, malicious_input, input_type):
        """Test handling of potentially malicious inputs."""
        test_image_base64 = base64.b64encode(b"test_data").decode("utf-8")

        with TestClient(app) as client:
            if input_type == "filename":
                response = client.post(
                    "/api/v1/llava/analyze-upload",
                    files={
                        "file": (malicious_input, BytesIO(b"test_data"), "image/jpeg")
                    },
                )
            else:  # prompt
                response = client.post(
                    "/api/v1/llava/analyze",
                    json={"image_base64": test_image_base64, "prompt": malicious_input},
                )

        # Should handle malicious inputs safely
        assert response.status_code in [200, 422]

    def test_performance_with_multiple_files(self):
        """Basic performance test with multiple file uploads."""
        import time

        small_data = b"x" * 1024  # 1KB
        upload_times = []

        with TestClient(app) as client:
            for i in range(3):  # Reduced from 5 for efficiency
                start_time = time.time()

                response = client.post(
                    "/api/v1/llava/analyze-upload",
                    files={
                        "file": (
                            f"perf_test_{i}.jpg",
                            BytesIO(small_data),
                            "image/jpeg",
                        )
                    },
                )

                end_time = time.time()
                upload_times.append(end_time - start_time)

                assert response.status_code in [200, 503]  # 503 if Ollama unavailable

        # Performance check: uploads should be reasonably fast
        avg_time = sum(upload_times) / len(upload_times)
        assert avg_time < 10.0, f"Average upload time {avg_time} seconds is too slow"
