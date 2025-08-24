"""
Integration tests focusing on cross-endpoint interactions and system behavior.
"""

import asyncio
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient
from httpx import AsyncClient

from main import app


class TestLLaVAIntegration:
    """Test LLaVA analysis integration and workflows."""

    async def test_file_upload_vs_base64_consistency_integration(
        self, async_client: AsyncClient, image_data
    ):
        """Test that file upload and base64 analysis produce consistent results."""
        base64_request = {
            "image_base64": image_data["base64"],
            "prompt": "Describe this image",
        }

        # Mock Ollama to return consistent responses
        mock_ollama_response = {
            "response": '{"detected": "YES", "description": "Test image analysis"}',
            "done": True,
            "model": "llava:latest",
        }

        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value.json.return_value = mock_ollama_response
            mock_post.return_value.status_code = 200

            # Test base64 analysis
            base64_response = await async_client.post(
                "/api/v1/llava/analyze", json=base64_request
            )

            # Test file upload analysis
            files = {"file": ("test.jpg", image_data["file"], "image/jpeg")}
            data = {"prompt": "Describe this image"}

            upload_response = await async_client.post(
                "/api/v1/llava/analyze-upload", files=files, data=data
            )

            # Both should succeed
            assert base64_response.status_code == 200
            assert upload_response.status_code == 200

            base64_data = base64_response.json()
            upload_data = upload_response.json()

            # Results should be consistent
            assert base64_data["description"] == upload_data["description"]
            assert base64_data["detected"] == upload_data["detected"]
            assert base64_data["success"] == upload_data["success"]

    def test_system_health_and_functionality_check(self, client: TestClient):
        """Test overall system health across all non-motion endpoints."""
        # Test health endpoint
        health_response = client.get("/health")
        assert health_response.status_code == 200

        # Test queue status
        queue_response = client.get("/api/v1/queue/status")
        assert queue_response.status_code == 200

        # Test SSE connections
        connections_response = client.get("/api/v1/events/connections")
        assert connections_response.status_code == 200

        # Test available prompts
        prompts_response = client.get("/api/v1/llava/prompts")
        assert prompts_response.status_code == 200

        # All endpoints should be responding
        responses = [
            health_response,
            queue_response,
            connections_response,
            prompts_response,
        ]
        assert all(r.status_code == 200 for r in responses)


class TestSystemBehaviorUnderLoad:
    """Test system behavior under various load conditions."""

    async def test_mixed_endpoint_concurrent_access(self, async_client: AsyncClient):
        """Test concurrent access to different endpoints doesn't cause issues."""

        async def call_health():
            return await async_client.get("/health")

        async def call_queue_status():
            return await async_client.get("/api/v1/queue/status")

        async def call_prompts():
            return await async_client.get("/api/v1/llava/prompts")

        async def call_connections():
            return await async_client.get("/api/v1/events/connections")

        # Run all calls concurrently
        tasks = [
            call_health(),
            call_queue_status(),
            call_prompts(),
            call_connections(),
            call_health(),  # Duplicate some calls
            call_queue_status(),
        ]

        responses = await asyncio.gather(*tasks, return_exceptions=True)

        # All requests should succeed
        for response in responses:
            assert not isinstance(response, Exception)
            assert response.status_code == 200

    def test_error_recovery_across_endpoints(self, client: TestClient):
        """Test that errors in one endpoint don't affect others."""
        # Make some invalid requests
        client.get("/api/v1/nonexistent")
        client.post("/api/v1/llava/analyze", json={})  # Invalid data

        # Valid endpoints should still work
        health_response = client.get("/health")
        assert health_response.status_code == 200

        queue_response = client.get("/api/v1/queue/status")
        assert queue_response.status_code == 200

        connections_response = client.get("/api/v1/events/connections")
        assert connections_response.status_code == 200


class TestSystemLimitsAndBoundaries:
    """Test system behavior at limits and boundaries."""

    def test_large_data_handling_integration(self, client: TestClient):
        """Test system behavior with large data across endpoints."""
        # Test large base64 data
        large_base64 = "x" * (5 * 1024 * 1024)  # 5MB base64 string
        large_request = {
            "image_base64": large_base64,
            "prompt": "Analyze this large image",
        }

        # This should fail gracefully, not crash the system
        response = client.post("/api/v1/llava/analyze", json=large_request)

        # Should handle gracefully (either 422 for validation or 413 for too large)
        assert response.status_code in [400, 413, 422]

        # System should still be responsive
        health_response = client.get("/health")
        assert health_response.status_code == 200
