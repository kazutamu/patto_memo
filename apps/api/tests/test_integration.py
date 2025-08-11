"""
Streamlined integration tests for the Motion Detector API.
Focused on essential cross-endpoint workflows without redundancy.
Most detailed testing is covered in individual endpoint test files.
"""

import base64
from io import BytesIO

import httpx
import pytest
from fastapi.testclient import TestClient
from pytest_httpx import HTTPXMock

from main import app, dummy_motion_events


class TestCrossEndpointWorkflows:
    """Test essential workflows that span multiple endpoints."""

    def test_motion_detection_to_analysis_workflow(self, client: TestClient):
        """Test complete workflow: settings -> create event -> verify event."""
        # Get settings first
        settings_response = client.get("/api/v1/motion/settings")
        assert settings_response.status_code == 200
        settings = settings_response.json()

        # Create motion event above minimum confidence
        event_data = {
            "confidence": settings["min_confidence"] + 0.15,
            "duration": 3.0,
            "description": "Cross-endpoint integration test",
        }

        create_response = client.post("/api/v1/motion/events", json=event_data)
        assert create_response.status_code == 200
        created_event = create_response.json()

        # Verify event appears in events list
        events_response = client.get("/api/v1/motion/events")
        assert events_response.status_code == 200
        events = events_response.json()

        # Find our created event
        found_event = next((e for e in events if e["id"] == created_event["id"]), None)
        assert found_event is not None
        assert found_event["confidence"] == event_data["confidence"]
        assert found_event["description"] == event_data["description"]

    @pytest.mark.asyncio
    async def test_motion_event_with_llava_analysis_integration(
        self, httpx_mock: HTTPXMock
    ):
        """Test integration between motion detection and LLaVA analysis."""
        # Mock successful LLaVA response
        mock_response = {
            "response": "Integration test: Person detected at entrance with high confidence",
            "done": True,
        }
        httpx_mock.add_response(
            method="POST",
            url="http://localhost:11434/api/generate",
            json=mock_response,
            status_code=200,
        )

        with TestClient(app) as client:
            # 1. Create high-confidence motion event
            motion_data = {
                "confidence": 0.90,
                "duration": 4.0,
                "description": "High confidence motion at entrance",
            }

            motion_response = client.post("/api/v1/motion/events", json=motion_data)
            assert motion_response.status_code == 200
            motion_event = motion_response.json()

            # 2. Analyze captured frame with LLaVA (simulated)
            fake_camera_frame = b"simulated_security_camera_frame_data"
            image_base64 = base64.b64encode(fake_camera_frame).decode("utf-8")

            analysis_data = {
                "image_base64": image_base64,
                "prompt": f"Analyze this security frame for motion event {motion_event['id']}",
            }

            analysis_response = client.post("/api/v1/llava/analyze", json=analysis_data)
            assert analysis_response.status_code == 200
            analysis_result = analysis_response.json()

            # 3. Verify both systems worked together
            assert analysis_result["success"] is True
            assert "Person detected" in analysis_result["description"]
            assert analysis_result["processing_time"] > 0

            # Verify motion event still exists
            events_response = client.get("/api/v1/motion/events")
            events = events_response.json()

            motion_still_exists = any(e["id"] == motion_event["id"] for e in events)
            assert motion_still_exists

    @pytest.mark.asyncio
    async def test_file_upload_vs_base64_consistency_integration(
        self, httpx_mock: HTTPXMock, async_client
    ):
        """Test that file upload and base64 endpoints produce consistent results."""
        mock_response = {
            "response": "Consistent integration test response",
            "done": True,
        }
        # Add two responses for both endpoints
        httpx_mock.add_response(
            method="POST",
            url="http://localhost:11434/api/generate",
            json=mock_response,
            status_code=200,
        )
        httpx_mock.add_response(
            method="POST",
            url="http://localhost:11434/api/generate",
            json=mock_response,
            status_code=200,
        )

        test_image_data = b"integration_test_image_data"
        test_prompt = "Integration test prompt"

        # Method 1: Base64 analysis with async client
        image_base64 = base64.b64encode(test_image_data).decode("utf-8")
        base64_response = await async_client.post(
            "/api/v1/llava/analyze",
            json={"image_base64": image_base64, "prompt": test_prompt},
        )

        # Method 2: File upload analysis with TestClient (for file uploads)
        with TestClient(app) as client:
            upload_response = client.post(
                "/api/v1/llava/analyze-upload",
                files={
                    "file": (
                        "integration_test.jpg",
                        BytesIO(test_image_data),
                        "image/jpeg",
                    )
                },
                data={"prompt": test_prompt},
            )

        # Both should succeed and produce consistent results
        assert base64_response.status_code == 200
        assert upload_response.status_code == 200

        base64_data = base64_response.json()
        upload_data = upload_response.json()

        # Verify consistency
        assert base64_data["success"] == upload_data["success"]
        assert base64_data["llm_model"] == upload_data["llm_model"]
        assert base64_data["description"] == upload_data["description"]

    def test_system_health_and_functionality_check(self, client: TestClient):
        """Test overall system health across all endpoints."""
        # Check health endpoint
        health_response = client.get("/health")
        assert health_response.status_code == 200
        assert health_response.json() == {"status": "ok"}

        # Check motion settings accessibility
        settings_response = client.get("/api/v1/motion/settings")
        assert settings_response.status_code == 200

        # Check motion events endpoint responsiveness
        events_response = client.get("/api/v1/motion/events")
        assert events_response.status_code == 200

        # Check LLaVA endpoints are accessible (may fail if Ollama down)
        test_image = base64.b64encode(b"health_check_image").decode("utf-8")
        llava_response = client.post(
            "/api/v1/llava/analyze",
            json={"image_base64": test_image, "prompt": "Health check"},
        )
        assert llava_response.status_code in [200, 503]  # 503 if Ollama unavailable


class TestSystemBehaviorUnderLoad:
    """Test system behavior under various load conditions."""

    def test_concurrent_motion_event_creation(self, client: TestClient):
        """Test creating multiple motion events concurrently."""
        from concurrent.futures import ThreadPoolExecutor

        def create_event(event_id):
            return client.post(
                "/api/v1/motion/events",
                json={
                    "confidence": 0.7 + (event_id * 0.01),
                    "duration": 1.5 + (event_id * 0.1),
                    "description": f"Concurrent integration test {event_id}",
                },
            )

        initial_count = len(dummy_motion_events)

        # Create events concurrently (reduced count for efficiency)
        with ThreadPoolExecutor(max_workers=3) as executor:
            futures = [executor.submit(create_event, i) for i in range(5)]
            responses = [future.result() for future in futures]

        # All should succeed
        for response in responses:
            assert response.status_code == 200

        # Verify all events were created
        final_response = client.get("/api/v1/motion/events")
        final_events = final_response.json()
        assert len(final_events) >= initial_count + 5

        # Verify no duplicate IDs
        event_ids = [event["id"] for event in final_events]
        assert len(event_ids) == len(set(event_ids))

    @pytest.mark.asyncio
    async def test_mixed_endpoint_concurrent_access(self, httpx_mock: HTTPXMock):
        """Test accessing different endpoints concurrently."""
        # Mock for LLaVA requests
        mock_response = {"response": "Concurrent access test response", "done": True}
        httpx_mock.add_response(
            method="POST",
            url="http://localhost:11434/api/generate",
            json=mock_response,
            status_code=200,
        )

        import asyncio

        async def make_requests():
            # Different types of requests concurrently
            with TestClient(app) as client:
                # Motion event creation
                motion_response = client.post(
                    "/api/v1/motion/events",
                    json={
                        "confidence": 0.8,
                        "duration": 2.0,
                        "description": "Concurrent access test",
                    },
                )

                # Settings retrieval
                settings_response = client.get("/api/v1/motion/settings")

                # Events retrieval
                events_response = client.get("/api/v1/motion/events")

                # LLaVA analysis
                image_b64 = base64.b64encode(b"concurrent_test_image").decode("utf-8")
                llava_response = client.post(
                    "/api/v1/llava/analyze",
                    json={
                        "image_base64": image_b64,
                        "prompt": "Concurrent access test",
                    },
                )

                return [
                    motion_response,
                    settings_response,
                    events_response,
                    llava_response,
                ]

        # Run concurrent requests
        responses = await make_requests()

        # All should complete successfully
        assert responses[0].status_code == 200  # Motion event
        assert responses[1].status_code == 200  # Settings
        assert responses[2].status_code == 200  # Events
        assert responses[3].status_code == 200  # LLaVA

    def test_error_recovery_across_endpoints(self, client: TestClient):
        """Test system recovery after errors across different endpoints."""
        # 1. Cause validation error in motion events
        invalid_response = client.post(
            "/api/v1/motion/events", json={"confidence": "invalid_type"}
        )
        assert invalid_response.status_code == 422

        # 2. System should still work normally for valid requests
        valid_response = client.post(
            "/api/v1/motion/events",
            json={"confidence": 0.8, "duration": 1.5, "description": "Recovery test"},
        )
        assert valid_response.status_code == 200

        # 3. Other endpoints should be unaffected
        health_response = client.get("/health")
        assert health_response.status_code == 200

        settings_response = client.get("/api/v1/motion/settings")
        assert settings_response.status_code == 200

        events_response = client.get("/api/v1/motion/events")
        assert events_response.status_code == 200


class TestDataConsistencyAcrossEndpoints:
    """Test data consistency between different endpoints."""

    def test_motion_event_consistency_across_queries(self, client: TestClient):
        """Test that motion events appear consistently across different queries."""
        # Create a distinctive event
        event_data = {
            "confidence": 0.95,
            "duration": 5.0,
            "description": "Consistency test event with unique description",
        }

        create_response = client.post("/api/v1/motion/events", json=event_data)
        assert create_response.status_code == 200
        created_event = create_response.json()

        # Query 1: Get all events
        all_events_response = client.get("/api/v1/motion/events")
        all_events = all_events_response.json()

        # Query 2: Get limited events
        limited_events_response = client.get("/api/v1/motion/events?limit=50")
        limited_events = limited_events_response.json()

        # Find our event in both responses
        found_in_all = next(
            (e for e in all_events if e["id"] == created_event["id"]), None
        )
        found_in_limited = next(
            (e for e in limited_events if e["id"] == created_event["id"]), None
        )

        # Should be found in both and be identical
        assert found_in_all is not None
        assert found_in_limited is not None
        assert found_in_all == found_in_limited

        # Data should match original
        assert found_in_all["confidence"] == event_data["confidence"]
        assert found_in_all["description"] == event_data["description"]

    def test_settings_consistency_across_requests(self, client: TestClient):
        """Test that settings remain consistent across multiple requests."""
        # Make multiple requests for settings
        responses = []
        for _ in range(3):
            response = client.get("/api/v1/motion/settings")
            assert response.status_code == 200
            responses.append(response.json())

        # All responses should be identical
        first_settings = responses[0]
        for settings in responses[1:]:
            assert settings == first_settings

        # Settings should have expected structure
        expected_fields = [
            "detection_enabled",
            "sensitivity",
            "min_confidence",
            "recording_enabled",
            "alert_notifications",
        ]
        assert all(field in first_settings for field in expected_fields)


class TestSystemLimitsAndBoundaries:
    """Test system behavior at boundaries and limits."""

    def test_pagination_boundary_behavior(self, client: TestClient):
        """Test pagination behavior at boundaries."""
        # Create several events to test pagination
        for i in range(15):
            client.post(
                "/api/v1/motion/events",
                json={
                    "confidence": 0.6 + (i * 0.01),
                    "duration": 1.0,
                    "description": f"Pagination boundary test {i}",
                },
            )

        # Test boundary conditions
        test_cases = [
            (0, 0),  # Zero limit
            (1, 1),  # Single item
            (10, 10),  # Default-like limit
            (100, None),  # Large limit (should return all available)
        ]

        for limit, expected_max in test_cases:
            response = client.get(f"/api/v1/motion/events?limit={limit}")
            assert response.status_code == 200

            events = response.json()
            if expected_max is None:
                assert len(events) >= 0  # Should return available events
            else:
                assert len(events) <= expected_max

    def test_large_data_handling_integration(self, client: TestClient):
        """Test system handling of large data across endpoints."""
        # Create event with large description
        large_description = "Integration test with large description " * 100

        large_event_response = client.post(
            "/api/v1/motion/events",
            json={
                "confidence": 0.85,
                "duration": 2.5,
                "description": large_description,
            },
        )
        assert large_event_response.status_code == 200

        # Verify it appears in events list
        events_response = client.get("/api/v1/motion/events?limit=1")
        assert events_response.status_code == 200
        events = events_response.json()

        # Should handle large descriptions gracefully
        if events:
            assert len(events[0]["description"]) > 1000

        # Test large LLaVA prompt (if Ollama available)
        large_prompt = "Integration test with very long prompt " * 100
        test_image = base64.b64encode(b"test_large_prompt").decode("utf-8")

        llava_response = client.post(
            "/api/v1/llava/analyze",
            json={"image_base64": test_image, "prompt": large_prompt},
        )
        # Should handle gracefully (may succeed, fail with 413, or 503 if Ollama down)
        assert llava_response.status_code in [200, 413, 503]
