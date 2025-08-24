import base64
import json
import os
import re
from datetime import datetime
from io import BytesIO
from typing import Dict, Optional

import google.generativeai as genai
from PIL import Image


class GeminiConfig:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        self.model_name = "gemini-1.5-flash"
        self.timeout = 30  # seconds
        
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY environment variable is required")
        
        # Configure the Gemini client
        genai.configure(api_key=self.api_key)


class GeminiAnalyzer:
    def __init__(self, config: Optional[GeminiConfig] = None):
        self.config = config or GeminiConfig()
        self.model = genai.GenerativeModel(self.config.model_name)
    
    def _decode_base64_image(self, image_base64: str) -> Image.Image:
        """Decode base64 image string to PIL Image"""
        try:
            # Remove data URL prefix if present
            if image_base64.startswith('data:image/'):
                image_base64 = image_base64.split(',', 1)[1]
            
            # Decode base64
            image_data = base64.b64decode(image_base64)
            
            # Create PIL Image
            image = Image.open(BytesIO(image_data))
            
            # Convert to RGB if necessary
            if image.mode != 'RGB':
                image = image.convert('RGB')
                
            return image
        except Exception as e:
            raise ValueError(f"Failed to decode image: {str(e)}")
    
    def _create_analysis_prompt(self, user_prompt: Optional[str] = None) -> str:
        """Create structured prompt for Gemini"""
        json_format = """You MUST respond with ONLY a valid JSON object. Do not include any text before or after the JSON.
The JSON must have exactly this structure:
{
  "detected": "YES" or "NO",
  "description": "your detailed answer here"
}

Important rules:
1. Start your response with { and end with }
2. Use double quotes for all strings
3. The "detected" field must be exactly "YES" or "NO" (uppercase)
4. The "description" field must contain your analysis
5. No additional text, explanations, or formatting outside the JSON"""

        if user_prompt:
            # User provided a custom prompt
            prompt = f'{json_format}\n\nSet detected to "YES" if the answer to this question is affirmative/positive, "NO" otherwise.\nQuestion: {user_prompt}'
        else:
            # Default prompt
            prompt = f'{json_format}\n\nSet detected to "YES" if you see any motion/activity/person in the image, "NO" if the image appears static or empty.\nIn the description field, analyze what you see, focusing on any actions, posture, and activities.'
        
        return prompt
    
    def _parse_response(self, response_text: str) -> Dict[str, Optional[str]]:
        """Parse Gemini response and extract JSON"""
        detected_status = None
        description_text = response_text
        
        # First, try to parse as direct JSON
        try:
            parsed_result = json.loads(response_text)
            if isinstance(parsed_result, dict):
                detected_status = parsed_result.get("detected", None)
                description_text = parsed_result.get("description", response_text)
                return {"detected": detected_status, "description": description_text}
        except (json.JSONDecodeError, AttributeError):
            pass
        
        # If not valid JSON, try to extract JSON from the text
        json_match = re.search(r'\{[^{}]*"detected"[^{}]*\}', response_text, re.DOTALL)
        if json_match:
            try:
                parsed_result = json.loads(json_match.group())
                if isinstance(parsed_result, dict):
                    detected_status = parsed_result.get("detected", None)
                    description_text = parsed_result.get("description", response_text)
                    return {"detected": detected_status, "description": description_text}
            except json.JSONDecodeError:
                pass
        
        # As a last resort, look for YES/NO pattern in the text
        if re.search(r"\b(YES|yes|Yes)\b", response_text):
            detected_status = "YES"
        elif re.search(r"\b(NO|no|No)\b", response_text):
            detected_status = "NO"
        
        # Clean up the description by removing any JSON-like formatting
        description_text = re.sub(r'[{}"]', "", response_text).strip()
        
        return {"detected": detected_status, "description": description_text}
    
    async def analyze_image(self, image_base64: str, user_prompt: Optional[str] = None) -> Dict:
        """Analyze image using Gemini API"""
        start_time = datetime.now()
        
        try:
            # Decode the image
            image = self._decode_base64_image(image_base64)
            
            # Create the prompt
            prompt = self._create_analysis_prompt(user_prompt)
            
            # Generate content with Gemini
            response = self.model.generate_content([prompt, image])
            
            if not response.text:
                raise Exception("Empty response from Gemini API")
            
            # Parse the response
            parsed = self._parse_response(response.text)
            
            processing_time = (datetime.now() - start_time).total_seconds()
            
            return {
                "description": parsed["description"],
                "detected": parsed["detected"],
                "processing_time": processing_time,
                "llm_model": self.config.model_name,
                "success": True,
                "error_message": None
            }
            
        except Exception as e:
            processing_time = (datetime.now() - start_time).total_seconds()
            error_message = str(e)
            
            # Handle specific error types
            if "API key" in error_message.lower():
                error_message = "Invalid or missing Gemini API key"
            elif "quota" in error_message.lower():
                error_message = "Gemini API quota exceeded"
            elif "timeout" in error_message.lower():
                error_message = "Gemini API timeout"
            
            return {
                "description": "",
                "detected": None,
                "processing_time": processing_time,
                "llm_model": self.config.model_name,
                "success": False,
                "error_message": error_message
            }


# Global analyzer instance
_analyzer = None

def get_analyzer() -> GeminiAnalyzer:
    """Get or create global Gemini analyzer instance"""
    global _analyzer
    if _analyzer is None:
        _analyzer = GeminiAnalyzer()
    return _analyzer


async def analyze_with_gemini(image_base64: str, user_prompt: Optional[str] = None) -> Dict:
    """Analyze image using Gemini - main function for API"""
    analyzer = get_analyzer()
    return await analyzer.analyze_image(image_base64, user_prompt)