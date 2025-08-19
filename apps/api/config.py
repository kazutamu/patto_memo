"""
Configuration for the API backend
"""

# LLaVA Analysis Configuration
LLAVA_CONFIG = {
    "default_prompt": 'Respond ONLY with valid JSON in this exact format: {"detected": "YES" or "NO", "description": "your description"}. Set detected to "YES" if motion/activity is detected, "NO" if not. In description, analyze what the person is doing, focusing on their actions, posture, and activities. Be specific about movements, gestures, or tasks being performed.',
    "detailed_activity_prompt": 'Respond ONLY with valid JSON in this exact format: {"detected": "YES" or "NO", "description": "your description"}. Set detected to "YES" if people are visible and active, "NO" if not. In description, describe in detail what each person is doing including: body position, what they are holding, specific actions, and any movements or gestures.',
    "quick_activity_prompt": 'Respond ONLY with valid JSON in this exact format: {"detected": "YES" or "NO", "description": "your description"}. Set detected to "YES" if activity is detected, "NO" if not. In description, briefly state what specific activity the person is performing.',
    "security_prompt": 'Respond ONLY with valid JSON in this exact format: {"detected": "YES" or "NO", "description": "your description"}. Set detected to "YES" if there is any security concern, "NO" if normal. In description, analyze from a security perspective what the person is doing and whether their behavior is normal or suspicious.',
    "model": "llava:latest",
    "timeout": 30,
}

# Motion Detection Configuration
MOTION_CONFIG = {
    "default_sensitivity": 0.5,
    "significance_threshold": 0.7,
    "ai_analysis_enabled": True,
}
