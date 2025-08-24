"""
Streamlined Pydantic model validation tests.
Consolidated from verbose, repetitive test classes with parameterized tests.
"""

import pytest
from pydantic import ValidationError

from main import (
    ImageAnalysisRequest,
    ImageAnalysisResponse,
)


class TestImageAnalysisModels:
    """Test Image Analysis Pydantic models."""

    def test_image_analysis_request_creation(self, image_data):
        """Test ImageAnalysisRequest creation with various image data."""
        request = ImageAnalysisRequest(
            image_base64=image_data["base64"], prompt="Custom prompt"
        )
        assert request.image_base64 == image_data["base64"]
        assert request.prompt == "Custom prompt"

    def test_image_analysis_request_default_prompt(self, image_data):
        """Test ImageAnalysisRequest with default prompt."""
        request = ImageAnalysisRequest(image_base64=image_data["base64"])
        assert request.image_base64 == image_data["base64"]
        # Should have optional prompt
        assert hasattr(request, 'prompt')

    @pytest.mark.parametrize(
        "invalid_data,expected_error",
        [
            ({}, "Field required"),  # Missing image_base64
            ({"prompt": "Test"}, "Field required"),  # Missing image_base64
            ({"image_base64": None}, "Input should be a valid string"),  # Null image
        ],
    )
    def test_image_analysis_request_validation_errors(self, invalid_data, expected_error):
        """Test ImageAnalysisRequest validation with invalid data."""
        with pytest.raises(ValidationError) as exc_info:
            ImageAnalysisRequest(**invalid_data)

        errors = exc_info.value.errors()
        assert any(expected_error in str(error) for error in errors)

    @pytest.mark.parametrize(
        "response_data",
        [
            {
                "description": "Test description",
                "processing_time": 1.5,
                "llm_model": "gemini-1.5-flash",
                "success": True,
            },
            {
                "description": "Another test",
                "detected": "YES",
                "processing_time": 2.3,
                "llm_model": "gemini-1.5-flash",
                "success": True,
                "error_message": None,
            },
            {
                "description": "",
                "processing_time": 0.5,
                "llm_model": "gemini-1.5-flash",
                "success": False,
                "error_message": "Analysis failed",
            },
        ],
    )
    def test_image_analysis_response_creation(self, response_data):
        """Test ImageAnalysisResponse creation with various valid data."""
        response = ImageAnalysisResponse(**response_data)

        assert response.description == response_data["description"]
        assert response.processing_time == response_data["processing_time"]
        assert response.llm_model == response_data["llm_model"]
        assert response.success == response_data["success"]

        # Optional fields
        if "detected" in response_data:
            assert response.detected == response_data["detected"]
        if "error_message" in response_data:
            assert response.error_message == response_data["error_message"]

    @pytest.mark.parametrize(
        "invalid_response_data,expected_error",
        [
            ({}, "Field required"),  # Missing required fields
            (
                {"description": "Test"},
                "Field required",
            ),  # Missing processing_time, llm_model, success
            (
                {
                    "description": "Test",
                    "processing_time": "invalid",
                    "llm_model": "gemini-1.5-flash",
                    "success": True,
                },
                "Input should be a valid number",
            ),  # Invalid processing_time type
        ],
    )
    def test_image_analysis_response_validation_errors(
        self, invalid_response_data, expected_error
    ):
        """Test ImageAnalysisResponse validation with invalid data."""
        with pytest.raises(ValidationError) as exc_info:
            ImageAnalysisResponse(**invalid_response_data)

        errors = exc_info.value.errors()
        assert any(expected_error in str(error) for error in errors)

    def test_image_analysis_json_serialization(self, image_data):
        """Test JSON serialization and deserialization of Image Analysis models."""
        # Test request serialization
        original_request = ImageAnalysisRequest(
            image_base64=image_data["base64"], prompt="Test prompt"
        )
        request_json = original_request.model_dump_json()
        reconstructed_request = ImageAnalysisRequest.model_validate_json(request_json)

        assert original_request.image_base64 == reconstructed_request.image_base64
        assert original_request.prompt == reconstructed_request.prompt

        # Test response serialization
        original_response = ImageAnalysisResponse(
            description="Test response",
            detected="YES",
            processing_time=1.5,
            llm_model="gemini-1.5-flash",
            success=True,
        )
        response_json = original_response.model_dump_json()
        reconstructed_response = ImageAnalysisResponse.model_validate_json(
            response_json
        )

        assert original_response.description == reconstructed_response.description
        assert original_response.detected == reconstructed_response.detected
        assert (
            original_response.processing_time == reconstructed_response.processing_time
        )
        assert original_response.llm_model == reconstructed_response.llm_model
        assert original_response.success == reconstructed_response.success
