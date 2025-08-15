"""
Configuration for the API backend
"""

# LLaVA Analysis Configuration
LLAVA_CONFIG = {
    "default_prompt": "Analyze this image and describe specifically what the person is doing. Focus on their actions, posture, and activities. If multiple people are present, describe each person's activity. Be specific about movements, gestures, or tasks being performed.",
    "detailed_activity_prompt": "Describe in detail what each person in this image is doing. Include: 1) Their body position and posture, 2) What they are holding or interacting with, 3) The specific action or activity they are performing, 4) Any movement or gesture they are making. If no people are visible, state that clearly.",
    "quick_activity_prompt": "What specific activity is the person performing in this image?",
    "security_prompt": "From a security perspective, describe what the person is doing. Are they performing normal activities, suspicious behavior, or potentially concerning actions? Be specific about their movements and intentions.",
    "model": "llava:latest",
    "timeout": 30,
}

# Motion Detection Configuration
MOTION_CONFIG = {
    "default_sensitivity": 0.5,
    "significance_threshold": 0.7,
    "ai_analysis_enabled": True,
}
