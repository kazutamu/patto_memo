"""
Streamlined Pydantic model validation tests.
Consolidated from verbose, repetitive test classes with parameterized tests.
"""

import pytest
from pydantic import ValidationError

from main import (
    LLaVAAnalysisRequest,
    LLaVAAnalysisResponse,
    MotionEvent,
    MotionEventCreate,
    MotionSettings,
)


class TestMotionEventModels:
    """Test MotionEvent-related Pydantic models."""

    @pytest.mark.parametrize(
        "model_class,valid_data",
        [
            (
                MotionEventCreate,
                {"confidence": 0.85, "duration": 2.3, "description": "Test"},
            ),
            (MotionEventCreate, {"confidence": 0.7, "duration": 1.5}),  # Minimal fields
            (
                MotionEvent,
                {
                    "id": 1,
                    "timestamp": "2025-08-10T10:30:00Z",
                    "confidence": 0.85,
                    "duration": 2.3,
                    "description": "Test",
                },
            ),
        ],
    )
    def test_valid_model_creation(self, model_class, valid_data):
        """Test creating valid model instances."""
        instance = model_class(**valid_data)
        for field, value in valid_data.items():
            assert getattr(instance, field) == value

        # Check default description for MotionEventCreate
        if model_class == MotionEventCreate and "description" not in valid_data:
            assert instance.description == ""

    @pytest.mark.parametrize(
        "model_class,missing_field,base_data",
        [
            (MotionEventCreate, "confidence", {"duration": 2.0}),
            (MotionEventCreate, "duration", {"confidence": 0.8}),
            (
                MotionEvent,
                "id",
                {
                    "timestamp": "2025-08-10T10:30:00Z",
                    "confidence": 0.85,
                    "duration": 2.3,
                    "description": "Test",
                },
            ),
            (
                MotionEvent,
                "timestamp",
                {"id": 1, "confidence": 0.85, "duration": 2.3, "description": "Test"},
            ),
        ],
    )
    def test_missing_required_fields(self, model_class, missing_field, base_data):
        """Test validation errors for missing required fields."""
        with pytest.raises(ValidationError) as exc_info:
            model_class(**base_data)

        errors = exc_info.value.errors()
        assert any(error["loc"] == (missing_field,) for error in errors)

    @pytest.mark.parametrize(
        "model_class,field,invalid_value,base_data",
        [
            (MotionEventCreate, "confidence", "invalid", {"duration": 2.0}),
            (MotionEventCreate, "duration", "invalid", {"confidence": 0.8}),
            (
                MotionEventCreate,
                "description",
                123,
                {"confidence": 0.8, "duration": 2.0},
            ),
            (
                MotionEvent,
                "id",
                "invalid",
                {
                    "timestamp": "2025-08-10T10:30:00Z",
                    "confidence": 0.85,
                    "duration": 2.3,
                    "description": "Test",
                },
            ),
            (
                MotionEvent,
                "timestamp",
                123456,
                {"id": 1, "confidence": 0.85, "duration": 2.3, "description": "Test"},
            ),
        ],
    )
    def test_invalid_field_types(self, model_class, field, invalid_value, base_data):
        """Test validation errors for invalid field types."""
        data = {**base_data, field: invalid_value}
        with pytest.raises(ValidationError) as exc_info:
            model_class(**data)

        errors = exc_info.value.errors()
        assert any(error["loc"] == (field,) for error in errors)

    @pytest.mark.parametrize(
        "confidence,duration",
        [
            (0.0, 0.0),  # Zero values
            (0.001, 0.001),  # Very small values
            (999.999, 999.999),  # Large values
            (-0.1, -1.0),  # Negative values (accepted but may be business logic issue)
            (0.999999999999999, 1.0),  # High precision
        ],
    )
    def test_boundary_values(self, confidence, duration):
        """Test boundary and edge case values."""
        event = MotionEventCreate(confidence=confidence, duration=duration)
        assert event.confidence == confidence
        assert event.duration == duration

    def test_serialization_round_trip(self):
        """Test model serialization and deserialization."""
        original = MotionEventCreate(confidence=0.8, duration=1.5, description="Test")
        json_str = original.model_dump_json()
        reconstructed = MotionEventCreate.model_validate_json(json_str)

        assert original.confidence == reconstructed.confidence
        assert original.duration == reconstructed.duration
        assert original.description == reconstructed.description


class TestMotionSettingsModel:
    """Test MotionSettings Pydantic model."""

    def test_valid_settings_creation(self, sample_motion_settings):
        """Test creating valid MotionSettings instance."""
        settings = MotionSettings(**sample_motion_settings)
        for field, value in sample_motion_settings.items():
            assert getattr(settings, field) == value

    @pytest.mark.parametrize(
        "boolean_field",
        ["detection_enabled", "recording_enabled", "alert_notifications"],
    )
    def test_boolean_field_validation(self, boolean_field, sample_motion_settings):
        """Test validation of boolean fields."""
        # Valid boolean
        settings = MotionSettings(**sample_motion_settings)
        assert isinstance(getattr(settings, boolean_field), bool)

        # Invalid boolean type
        invalid_data = {**sample_motion_settings, boolean_field: "invalid"}
        with pytest.raises(ValidationError) as exc_info:
            MotionSettings(**invalid_data)

        errors = exc_info.value.errors()
        assert any(error["loc"] == (boolean_field,) for error in errors)

    @pytest.mark.parametrize("numeric_field", ["sensitivity", "min_confidence"])
    def test_numeric_field_validation(self, numeric_field, sample_motion_settings):
        """Test validation of numeric fields."""
        # Valid numeric values
        settings = MotionSettings(**sample_motion_settings)
        assert isinstance(getattr(settings, numeric_field), (int, float))

        # Invalid numeric type
        invalid_data = {**sample_motion_settings, numeric_field: "invalid"}
        with pytest.raises(ValidationError) as exc_info:
            MotionSettings(**invalid_data)

        errors = exc_info.value.errors()
        assert any(error["loc"] == (numeric_field,) for error in errors)

    @pytest.mark.parametrize(
        "sensitivity,min_confidence",
        [
            (0.0, 0.0),  # Zero values
            (1.0, 1.0),  # Maximum typical values
            (2.0, -0.1),  # Values beyond typical range (accepted)
        ],
    )
    def test_numeric_boundary_values(self, sensitivity, min_confidence):
        """Test boundary values for numeric fields."""
        settings = MotionSettings(
            detection_enabled=True,
            sensitivity=sensitivity,
            min_confidence=min_confidence,
            recording_enabled=True,
            alert_notifications=True,
        )
        assert settings.sensitivity == sensitivity
        assert settings.min_confidence == min_confidence


class TestLLaVAModels:
    """Test LLaVA-related Pydantic models."""

    def test_llava_request_creation(self, image_data):
        """Test LLaVAAnalysisRequest creation with various image data."""
        request = LLaVAAnalysisRequest(
            image_base64=image_data["base64"], prompt="Custom prompt"
        )
        assert request.image_base64 == image_data["base64"]
        assert request.prompt == "Custom prompt"

    def test_llava_request_default_prompt(self, image_data):
        """Test LLaVAAnalysisRequest with default prompt."""
        request = LLaVAAnalysisRequest(image_base64=image_data["base64"])
        assert request.prompt == "Analyze this image and describe specifically what the person is doing. Focus on their actions, posture, and activities. If multiple people are present, describe each person's activity. Be specific about movements, gestures, or tasks being performed."

    @pytest.mark.parametrize(
        "success,description,error_message",
        [
            (True, "Analysis result", None),  # Success case
            (False, "", "Connection error"),  # Error case
            (False, "", None),  # Error without message
        ],
    )
    def test_llava_response_creation(self, success, description, error_message):
        """Test LLaVAAnalysisResponse creation for various scenarios."""
        response = LLaVAAnalysisResponse(
            description=description,
            processing_time=1.25,
            llm_model="llava:latest",
            success=success,
            error_message=error_message,
        )

        assert response.success == success
        assert response.description == description
        assert response.error_message == error_message
        assert response.processing_time == 1.25

    @pytest.mark.parametrize(
        "field,invalid_value",
        [
            ("image_base64", 123),  # Invalid image type
            ("prompt", 123),  # Invalid prompt type
            ("description", 123),  # Invalid description type
            ("processing_time", "invalid"),  # Invalid processing_time type
            ("success", "invalid"),  # Invalid success type
        ],
    )
    def test_llava_model_type_validation(self, field, invalid_value):
        """Test type validation for LLaVA models."""
        base_request_data = {"image_base64": "dGVzdA==", "prompt": "test"}
        base_response_data = {
            "description": "test",
            "processing_time": 1.0,
            "llm_model": "llava:latest",
            "success": True,
        }

        if field in base_request_data:
            invalid_data = {**base_request_data, field: invalid_value}
            with pytest.raises(ValidationError):
                LLaVAAnalysisRequest(**invalid_data)
        else:
            invalid_data = {**base_response_data, field: invalid_value}
            with pytest.raises(ValidationError):
                LLaVAAnalysisResponse(**invalid_data)

    def test_llava_request_serialization(self, image_data):
        """Test LLaVAAnalysisRequest serialization."""
        request = LLaVAAnalysisRequest(
            image_base64=image_data["base64"], prompt="Test prompt"
        )

        json_str = request.model_dump_json()
        reconstructed = LLaVAAnalysisRequest.model_validate_json(json_str)

        assert request.image_base64 == reconstructed.image_base64
        assert request.prompt == reconstructed.prompt

    @pytest.mark.parametrize(
        "processing_time",
        [
            0.0,  # Zero processing time
            0.001,  # Very small time
            999.999,  # Large time
            -1.0,  # Negative time (logically invalid but accepted by model)
        ],
    )
    def test_processing_time_boundary_values(self, processing_time):
        """Test boundary values for processing_time field."""
        response = LLaVAAnalysisResponse(
            description="Test",
            processing_time=processing_time,
            llm_model="llava:latest",
            success=True,
        )
        assert response.processing_time == processing_time


class TestModelInteroperability:
    """Test how models work together and handle edge cases."""

    def test_motion_event_create_to_motion_event_conversion(self):
        """Test converting MotionEventCreate to MotionEvent (API workflow simulation)."""
        create_data = MotionEventCreate(
            confidence=0.85, duration=2.3, description="Test event"
        )

        # Simulate API adding ID and timestamp
        event_data = create_data.model_dump()
        event_data.update({"id": 123, "timestamp": "2025-08-10T10:30:00Z"})

        motion_event = MotionEvent(**event_data)

        assert motion_event.confidence == create_data.confidence
        assert motion_event.duration == create_data.duration
        assert motion_event.description == create_data.description
        assert motion_event.id == 123

    def test_model_validation_error_details(self):
        """Test that validation errors provide useful information."""
        try:
            MotionEventCreate(confidence="invalid", duration=None)
        except ValidationError as e:
            errors = e.errors()

            # Should have errors for both fields
            assert len(errors) >= 2

            # Check error locations and messages
            error_locations = [error["loc"][0] for error in errors]
            assert "confidence" in error_locations
            assert "duration" in error_locations

            for error in errors:
                assert "type" in error
                assert "msg" in error
                assert error["msg"]  # Message should not be empty

    @pytest.mark.parametrize(
        "extra_field,value",
        [
            ("extra_field", "should_be_ignored"),
            ("another_field", 123),
        ],
    )
    def test_models_ignore_extra_fields(self, extra_field, value):
        """Test that models ignore extra fields during creation."""
        data_with_extra = {
            "confidence": 0.8,
            "duration": 1.5,
            "description": "Test",
            extra_field: value,
        }

        event = MotionEventCreate(**data_with_extra)

        # Extra field should not be included
        assert not hasattr(event, extra_field)
        assert event.confidence == 0.8
        assert event.duration == 1.5
