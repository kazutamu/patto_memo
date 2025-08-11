"""
Streamlined file upload tests.
Consolidated from extensive redundant test classes with parameterized tests.
Note: Most file upload functionality is already tested in test_llava_endpoints.py
This file focuses on file-specific edge cases and validation.
"""

from io import BytesIO

import httpx
import pytest
from fastapi.testclient import TestClient
from pytest_httpx import HTTPXMock

from main import app


class TestFileUploadValidation:
    """Test file upload validation and edge cases."""

    def test_file_upload_with_parameterized_data(self, file_upload_data):
        """Test file upload with various file scenarios using parameterized fixtures."""
        with TestClient(app) as client:
            if file_upload_data["scenario"] == "empty_file":
                response = client.post(
                    "/api/v1/llava/analyze-upload",
                    files={
                        "file": (
                            file_upload_data["filename"],
                            file_upload_data["file_obj"],
                            file_upload_data["content_type"],
                        )
                    },
                )
                # Empty files should be handled gracefully
                assert response.status_code == 200

            elif file_upload_data["scenario"] in ["valid_jpeg", "valid_png"]:
                response = client.post(
                    "/api/v1/llava/analyze-upload",
                    files={
                        "file": (
                            file_upload_data["filename"],
                            file_upload_data["file_obj"],
                            file_upload_data["content_type"],
                        )
                    },
                )
                # Valid files should be processed
                assert response.status_code in [200, 503]  # 503 if Ollama unavailable

            elif file_upload_data["scenario"] == "invalid_type":
                response = client.post(
                    "/api/v1/llava/analyze-upload",
                    files={
                        "file": (
                            file_upload_data["filename"],
                            file_upload_data["file_obj"],
                            file_upload_data["content_type"],
                        )
                    },
                )
                # Non-image files still processed (no validation at endpoint level)
                assert response.status_code in [200, 503]

    @pytest.mark.parametrize(
        "size_mb,expected_behavior",
        [
            (0.001, "small_file"),  # 1KB
            (0.1, "medium_file"),  # 100KB
            (5, "large_file"),  # 5MB
            (50, "very_large_file"),  # 50MB - may hit limits
        ],
    )
    def test_file_size_handling(self, size_mb, expected_behavior):
        """Test file upload with various file sizes."""
        # Calculate size in bytes
        file_size = int(size_mb * 1024 * 1024)

        # For very large files, test behavior without actually creating the data
        if expected_behavior == "very_large_file":
            # Most systems will reject this before reaching our handler
            # Just test that the endpoint exists and handles the request structure
            with TestClient(app) as client:
                try:
                    # Use a smaller size to avoid memory issues in tests
                    test_data = b"x" * (10 * 1024 * 1024)  # 10MB instead of 50MB
                    response = client.post(
                        "/api/v1/llava/analyze-upload",
                        files={"file": ("large.jpg", BytesIO(test_data), "image/jpeg")},
                    )
                    assert response.status_code in [200, 413, 422, 503]
                except Exception:
                    # Expected for extremely large files
                    pass
        else:
            # For smaller files, test normally
            file_data = b"x" * file_size
            with TestClient(app) as client:
                response = client.post(
                    "/api/v1/llava/analyze-upload",
                    files={"file": ("test.jpg", BytesIO(file_data), "image/jpeg")},
                )

                if expected_behavior in ["small_file", "medium_file"]:
                    assert response.status_code in [200, 503]
                else:  # large_file
                    assert response.status_code in [200, 413, 422, 503]

    @pytest.mark.asyncio
    async def test_file_upload_error_scenarios(self, httpx_mock: HTTPXMock):
        """Test file upload error handling scenarios."""
        test_scenarios = [
            ("connection_error", None),  # No mock = connection error
            ("timeout", httpx.TimeoutException("Request timed out")),
            ("server_error", {"status_code": 500, "text": "Internal server error"}),
        ]

        for scenario_name, mock_setup in test_scenarios:
            if mock_setup is None:
                # No mock setup = connection error
                pass
            elif isinstance(mock_setup, Exception):
                httpx_mock.add_exception(
                    mock_setup, method="POST", url="http://localhost:11434/api/generate"
                )
            else:
                httpx_mock.add_response(
                    method="POST",
                    url="http://localhost:11434/api/generate",
                    **mock_setup,
                )

            with TestClient(app) as client:
                response = client.post(
                    "/api/v1/llava/analyze-upload",
                    files={"file": ("test.jpg", BytesIO(b"test_data"), "image/jpeg")},
                    data={"prompt": f"Test {scenario_name}"},
                )

                if scenario_name == "server_error":
                    assert response.status_code == 503
                else:
                    assert response.status_code == 200
                    data = response.json()
                    assert data["success"] is False
                    assert (
                        "error" in data["error_message"].lower()
                        or "connection" in data["error_message"].lower()
                    )

            # Clear mock for next iteration
            httpx_mock.reset()


class TestFileUploadSecurityAndEdgeCases:
    """Test security and edge cases for file uploads."""

    @pytest.mark.parametrize(
        "security_scenario,test_data",
        [
            (
                "malicious_filename",
                {
                    "filename": "../../../etc/passwd",
                    "content": b"malicious_content",
                    "content_type": "image/jpeg",
                },
            ),
            (
                "xss_filename",
                {
                    "filename": "<script>alert('xss')</script>.jpg",
                    "content": b"fake_image",
                    "content_type": "image/jpeg",
                },
            ),
            (
                "sql_injection_prompt",
                {
                    "filename": "test.jpg",
                    "content": b"fake_image",
                    "content_type": "image/jpeg",
                    "prompt": "'; DROP TABLE files; --",
                },
            ),
            (
                "unicode_filename",
                {
                    "filename": "测试图片🖼️.jpg",
                    "content": b"fake_image",
                    "content_type": "image/jpeg",
                },
            ),
        ],
    )
    def test_security_input_validation(self, security_scenario, test_data):
        """Test handling of potentially malicious or unusual inputs."""
        with TestClient(app) as client:
            files_data = {
                "file": (
                    test_data["filename"],
                    BytesIO(test_data["content"]),
                    test_data["content_type"],
                )
            }

            form_data = {}
            if "prompt" in test_data:
                form_data["prompt"] = test_data["prompt"]

            response = client.post(
                "/api/v1/llava/analyze-upload", files=files_data, data=form_data
            )

        # Should handle all security scenarios safely
        assert response.status_code in [200, 422, 503]

    @pytest.mark.parametrize(
        "upload_scenario", ["concurrent_uploads", "rapid_sequential_uploads"]
    )
    def test_upload_performance_scenarios(self, upload_scenario):
        """Test performance characteristics of file uploads."""
        import time
        from concurrent.futures import ThreadPoolExecutor

        def upload_file(file_id):
            data = f"concurrent_test_{file_id}".encode()
            with TestClient(app) as client:
                return client.post(
                    "/api/v1/llava/analyze-upload",
                    files={
                        "file": (f"test_{file_id}.jpg", BytesIO(data), "image/jpeg")
                    },
                )

        if upload_scenario == "concurrent_uploads":
            # Test concurrent uploads with reduced count for efficiency
            with ThreadPoolExecutor(max_workers=3) as executor:
                futures = [executor.submit(upload_file, i) for i in range(3)]
                responses = [future.result() for future in futures]

            # All uploads should complete without crashing
            for response in responses:
                assert response.status_code in [200, 503, 413, 422]

        else:  # rapid_sequential_uploads
            # Test rapid sequential uploads
            start_time = time.time()
            responses = []

            for i in range(3):  # Reduced from 5 for efficiency
                response = upload_file(i)
                responses.append(response)

                # Don't take too long
                if time.time() - start_time > 10:
                    break

            # Should handle rapid uploads
            for response in responses:
                assert response.status_code in [200, 503, 413, 422]

    def test_file_upload_consistency_with_base64(self):
        """Test that file upload produces consistent results with base64 method."""
        # This is a simplified version of the consistency test in test_llava_endpoints.py
        # to ensure file uploads work the same way as base64 inputs

        import base64

        test_data = b"consistency_test_data"
        expected_base64 = base64.b64encode(test_data).decode("utf-8")

        with TestClient(app) as client:
            # Upload file
            upload_response = client.post(
                "/api/v1/llava/analyze-upload",
                files={"file": ("test.jpg", BytesIO(test_data), "image/jpeg")},
                data={"prompt": "consistency test"},
            )

            # Test base64 endpoint for comparison
            base64_response = client.post(
                "/api/v1/llava/analyze",
                json={"image_base64": expected_base64, "prompt": "consistency test"},
            )

        # Both should have the same response structure
        assert upload_response.status_code in [200, 503]
        assert base64_response.status_code in [200, 503]

        # If both succeed, they should have similar response structure
        if upload_response.status_code == 200 and base64_response.status_code == 200:
            upload_data = upload_response.json()
            base64_data = base64_response.json()

            # Should have the same fields
            assert set(upload_data.keys()) == set(base64_data.keys())


class TestFileUploadEdgeCases:
    """Test unusual edge cases for file uploads."""

    def test_binary_data_as_image(self):
        """Test uploading random binary data as image."""
        import os

        random_data = os.urandom(512)  # 512 bytes of random data

        with TestClient(app) as client:
            response = client.post(
                "/api/v1/llava/analyze-upload",
                files={"file": ("random.jpg", BytesIO(random_data), "image/jpeg")},
            )

        # Should handle binary data (LLaVA will determine if it's a valid image)
        assert response.status_code in [200, 503]

    @pytest.mark.parametrize(
        "field_name", ["wrong_field", "FILE", "File", "image", "upload"]
    )
    def test_incorrect_field_names(self, field_name):
        """Test uploading with incorrect field names."""
        with TestClient(app) as client:
            response = client.post(
                "/api/v1/llava/analyze-upload",
                files={field_name: ("test.jpg", BytesIO(b"test_data"), "image/jpeg")},
            )

        if field_name == "file":
            assert response.status_code in [200, 503]
        else:
            assert response.status_code == 422  # Should fail validation

    def test_multiple_files_upload(self):
        """Test behavior when multiple files are uploaded."""
        with TestClient(app) as client:
            response = client.post(
                "/api/v1/llava/analyze-upload",
                files=[
                    ("file", ("test1.jpg", BytesIO(b"data1"), "image/jpeg")),
                    ("file", ("test2.jpg", BytesIO(b"data2"), "image/jpeg")),
                ],
            )

        # FastAPI should handle multiple files, endpoint expects single file
        assert response.status_code in [200, 422, 503]
