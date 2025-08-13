"""
Configuration for the API backend
"""

# LLaVA Analysis Configuration
LLAVA_CONFIG = {
    "default_prompt": "Describe what is happening in 5 words or less",
    "model": "llava:latest",
    "timeout": 30,
}

# Motion Detection Configuration
MOTION_CONFIG = {
    "default_sensitivity": 0.5,
    "significance_threshold": 0.7,
    "ai_analysis_enabled": True,
}
