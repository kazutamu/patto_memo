"""
Tests for Gemini analyzer module.
"""

import base64
import io
import json
import os
from unittest.mock import AsyncMock, Mock, patch

import pytest
from PIL import Image

from gemini_analyzer import (
    GeminiAnalyzer,
    GeminiConfig,
    analyze_with_gemini,
    get_analyzer,
)


class TestGeminiConfig:
    """Test GeminiConfig class."""

    @patch.dict(os.environ, {"GEMINI_API_KEY": "test_api_key"})
    def test_config_initialization_with_api_key(self):
        """Test config initialization with API key."""
        config = GeminiConfig()
        assert config.api_key == "test_api_key"
        assert config.model_name == "gemini-1.5-flash"
        assert config.timeout == 30
        assert not config._configured

    @patch.dict(os.environ, {}, clear=True)
    def test_config_initialization_without_api_key(self):
        """Test config initialization without API key."""
        config = GeminiConfig()
        assert config.api_key is None
        assert config.model_name == "gemini-1.5-flash"
        assert config.timeout == 30
        assert not config._configured

    @patch.dict(os.environ, {"GEMINI_API_KEY": "test_api_key"})
    @patch("gemini_analyzer.genai.configure")
    def test_ensure_configured_with_api_key(self, mock_configure):
        """Test ensure_configured with valid API key."""
        config = GeminiConfig()
        config.ensure_configured()

        assert config._configured
        mock_configure.assert_called_once_with(api_key="test_api_key")

    @patch.dict(os.environ, {}, clear=True)
    def test_ensure_configured_without_api_key_raises_error(self):
        """Test ensure_configured without API key raises ValueError."""
        config = GeminiConfig()

        with pytest.raises(
            ValueError, match="GEMINI_API_KEY environment variable is required"
        ):
            config.ensure_configured()

    @patch.dict(os.environ, {"GEMINI_API_KEY": "test_api_key"})
    @patch("gemini_analyzer.genai.configure")
    def test_ensure_configured_only_runs_once(self, mock_configure):
        """Test ensure_configured only runs once."""
        config = GeminiConfig()
        config.ensure_configured()
        config.ensure_configured()  # Call twice

        # Should only configure once
        mock_configure.assert_called_once_with(api_key="test_api_key")


class TestGeminiAnalyzer:
    """Test GeminiAnalyzer class."""

    @patch.dict(os.environ, {"GEMINI_API_KEY": "test_api_key"})
    def test_analyzer_initialization(self):
        """Test analyzer initialization."""
        analyzer = GeminiAnalyzer()
        assert analyzer.config is not None
        assert analyzer.model is None  # Lazy initialization

    @patch.dict(os.environ, {"GEMINI_API_KEY": "test_api_key"})
    def test_analyzer_initialization_with_custom_config(self):
        """Test analyzer initialization with custom config."""
        config = GeminiConfig()
        analyzer = GeminiAnalyzer(config)
        assert analyzer.config is config
        assert analyzer.model is None

    def test_decode_base64_image_valid(self):
        """Test decoding valid base64 image."""
        # Create a simple test image
        img = Image.new("RGB", (10, 10), color="red")
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        img_data = buffer.getvalue()
        img_base64 = base64.b64encode(img_data).decode("utf-8")

        analyzer = GeminiAnalyzer()
        decoded_img = analyzer._decode_base64_image(img_base64)

        assert isinstance(decoded_img, Image.Image)
        assert decoded_img.mode == "RGB"
        assert decoded_img.size == (10, 10)

    def test_decode_base64_image_with_data_url_prefix(self):
        """Test decoding base64 image with data URL prefix."""
        # Create a simple test image
        img = Image.new("RGB", (10, 10), color="blue")
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        img_data = buffer.getvalue()
        img_base64 = base64.b64encode(img_data).decode("utf-8")
        img_data_url = f"data:image/png;base64,{img_base64}"

        analyzer = GeminiAnalyzer()
        decoded_img = analyzer._decode_base64_image(img_data_url)

        assert isinstance(decoded_img, Image.Image)
        assert decoded_img.mode == "RGB"

    def test_decode_base64_image_invalid(self):
        """Test decoding invalid base64 image."""
        analyzer = GeminiAnalyzer()

        with pytest.raises(ValueError, match="Failed to decode image"):
            analyzer._decode_base64_image("invalid_base64")

    def test_create_analysis_prompt_default(self):
        """Test creating default analysis prompt."""
        analyzer = GeminiAnalyzer()
        prompt = analyzer._create_analysis_prompt()

        assert "JSON" in prompt
        assert "detected" in prompt
        assert "YES" in prompt
        assert "NO" in prompt
        assert "motion/activity/person" in prompt

    def test_create_analysis_prompt_custom(self):
        """Test creating custom analysis prompt."""
        analyzer = GeminiAnalyzer()
        custom_prompt = "Is there a dog in this image?"
        prompt = analyzer._create_analysis_prompt(custom_prompt)

        assert "JSON" in prompt
        assert "detected" in prompt
        assert custom_prompt in prompt

    def test_parse_response_valid_json(self):
        """Test parsing valid JSON response."""
        analyzer = GeminiAnalyzer()
        response = '{"detected": "YES", "description": "A person is walking"}'

        result = analyzer._parse_response(response)

        assert result["detected"] == "YES"
        assert result["description"] == "A person is walking"

    def test_parse_response_embedded_json(self):
        """Test parsing response with embedded JSON."""
        analyzer = GeminiAnalyzer()
        response = 'Here is my analysis: {"detected": "NO", "description": "Empty room"} - that\'s what I see'

        result = analyzer._parse_response(response)

        assert result["detected"] == "NO"
        assert result["description"] == "Empty room"

    def test_parse_response_invalid_json_with_yes_no(self):
        """Test parsing invalid JSON but with YES/NO pattern."""
        analyzer = GeminiAnalyzer()
        response = "I can see a person walking, so YES there is motion"

        result = analyzer._parse_response(response)

        assert result["detected"] == "YES"
        assert "person walking" in result["description"]

    def test_parse_response_no_pattern(self):
        """Test parsing response with NO pattern."""
        analyzer = GeminiAnalyzer()
        response = "No motion detected in this image"

        result = analyzer._parse_response(response)

        assert result["detected"] == "NO"

    @pytest.mark.asyncio
    @patch.dict(os.environ, {"GEMINI_API_KEY": "test_api_key"})
    @patch("gemini_analyzer.genai.GenerativeModel")
    async def test_analyze_image_success(self, mock_model_class):
        """Test successful image analysis."""
        # Mock the model and response
        mock_model = Mock()
        mock_response = Mock()
        mock_response.text = '{"detected": "YES", "description": "A person walking"}'
        mock_model.generate_content.return_value = mock_response
        mock_model_class.return_value = mock_model

        # Create test image
        img = Image.new("RGB", (10, 10), color="red")
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        img_data = buffer.getvalue()
        img_base64 = base64.b64encode(img_data).decode("utf-8")

        analyzer = GeminiAnalyzer()
        result = await analyzer.analyze_image(img_base64)

        assert result["success"] is True
        assert result["detected"] == "YES"
        assert result["description"] == "A person walking"
        assert result["llm_model"] == "gemini-1.5-flash"
        assert result["processing_time"] > 0
        assert result["error_message"] is None

    @pytest.mark.asyncio
    @patch.dict(os.environ, {}, clear=True)
    async def test_analyze_image_no_api_key(self):
        """Test image analysis without API key."""
        analyzer = GeminiAnalyzer()

        result = await analyzer.analyze_image("fake_base64")

        assert result["success"] is False
        assert "GEMINI_API_KEY environment variable is required" in result["error_message"]
        assert result["processing_time"] > 0

    @pytest.mark.asyncio
    @patch.dict(os.environ, {"GEMINI_API_KEY": "test_api_key"})
    @patch("gemini_analyzer.genai.GenerativeModel")
    async def test_analyze_image_quota_error(self, mock_model_class):
        """Test image analysis with quota error."""
        mock_model = Mock()
        mock_model.generate_content.side_effect = Exception("quota exceeded")
        mock_model_class.return_value = mock_model

        # Create valid base64 image data
        from PIL import Image
        import io
        import base64
        img = Image.new("RGB", (10, 10), color="red")
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        img_data = buffer.getvalue()
        valid_base64 = base64.b64encode(img_data).decode("utf-8")

        analyzer = GeminiAnalyzer()
        result = await analyzer.analyze_image(valid_base64)

        assert result["success"] is False
        assert "Gemini API quota exceeded" in result["error_message"]

    @pytest.mark.asyncio
    @patch.dict(os.environ, {"GEMINI_API_KEY": "test_api_key"})
    @patch("gemini_analyzer.genai.GenerativeModel")
    async def test_analyze_image_timeout_error(self, mock_model_class):
        """Test image analysis with timeout error."""
        mock_model = Mock()
        mock_model.generate_content.side_effect = Exception("timeout occurred")
        mock_model_class.return_value = mock_model

        # Create valid base64 image data
        from PIL import Image
        import io
        import base64
        img = Image.new("RGB", (10, 10), color="blue")
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        img_data = buffer.getvalue()
        valid_base64 = base64.b64encode(img_data).decode("utf-8")

        analyzer = GeminiAnalyzer()
        result = await analyzer.analyze_image(valid_base64)

        assert result["success"] is False
        assert "Gemini API timeout" in result["error_message"]


class TestGlobalFunctions:
    """Test global functions."""

    @patch.dict(os.environ, {"GEMINI_API_KEY": "test_api_key"})
    def test_get_analyzer_singleton(self):
        """Test that get_analyzer returns singleton."""
        # Clear the global analyzer first
        import gemini_analyzer

        gemini_analyzer._analyzer = None

        analyzer1 = get_analyzer()
        analyzer2 = get_analyzer()

        assert analyzer1 is analyzer2

    @pytest.mark.asyncio
    @patch("gemini_analyzer.get_analyzer")
    async def test_analyze_with_gemini(self, mock_get_analyzer):
        """Test analyze_with_gemini function."""
        mock_analyzer = Mock()
        # Make the analyze_image return an async mock
        mock_analyzer.analyze_image = AsyncMock(return_value={"success": True, "detected": "YES"})
        mock_get_analyzer.return_value = mock_analyzer

        result = await analyze_with_gemini("test_base64", "test prompt")

        assert result["success"] is True
        assert result["detected"] == "YES"
        mock_analyzer.analyze_image.assert_called_once_with(
            "test_base64", "test prompt"
        )
