#!/usr/bin/env python3
"""
Minimal FastAPI server for Railway deployment
"""

import base64
import os
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from gemini_analyzer import analyze_with_gemini
from sse_manager import sse_manager

# Create FastAPI instance with a completely different name
server = FastAPI(
    title="Motion Detector API",
    description="AI-powered motion detection and analysis API",
    version="1.0.0"
)

# Get allowed origins from environment variable for production security
allowed_origins = os.getenv("ALLOWED_ORIGINS", "*").split(",")

# Configure CORS for SSE support
server.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


# Pydantic models for request/response validation


class ImageAnalysisRequest(BaseModel):
    image_base64: str = Field(..., description="Base64 encoded image")
    prompt: Optional[str] = Field(
        default="Analyze this image and describe specifically what the person is doing. Focus on their actions, posture, and activities. If multiple people are present, describe each person's activity. Be specific about movements, gestures, or tasks being performed.",
        description="Custom analysis prompt from user",
    )


class ImageAnalysisResponse(BaseModel):
    description: str
    detected: Optional[str] = None  # "YES" or "NO" for detection status
    processing_time: float
    llm_model: (
        str  # Changed from model_used to avoid Pydantic's protected namespace "model_"
    )
    success: bool
    error_message: Optional[str] = None


@server.get("/health")
def health_check():
    return {"status": "ok", "sse_connections": sse_manager.connection_count}


@server.get("/api/v1/ai/prompts")
def get_available_prompts():
    """
    Get available analysis prompt types and their descriptions
    """
    # This endpoint is kept for backward compatibility but simplified
    return {
        "info": "Custom prompts are now preferred. The system will automatically format your questions for optimal results.",
        "example_prompts": [
            "Is someone at the door?",
            "Are they smiling?",
            "Is anyone sleeping?",
            "What are they holding?",
            "Are they exercising?",
        ],
    }


@server.post("/api/v1/ai/analyze-image", response_model=ImageAnalysisResponse)
async def analyze_image(request: ImageAnalysisRequest):
    """
    Analyze an image using AI workflow
    """
    start_time = datetime.now()

    try:
        # Use Gemini API
        gemini_result = await analyze_with_gemini(request.image_base64, request.prompt)

        # Handle Gemini response
        if not gemini_result["success"]:
            if "quota" in gemini_result["error_message"].lower():
                raise HTTPException(status_code=503, detail="Service unavailable")

            # Return error response
            return ImageAnalysisResponse(
                description="",
                processing_time=gemini_result["processing_time"],
                llm_model=gemini_result["llm_model"],
                success=False,
                error_message=gemini_result["error_message"],
            )

        response = ImageAnalysisResponse(
            description=gemini_result["description"],
            detected=gemini_result["detected"],
            processing_time=gemini_result["processing_time"],
            llm_model=gemini_result["llm_model"],
            success=True,
        )

        # Broadcast AI analysis result to all connected SSE clients
        await sse_manager.broadcast(
            "ai_analysis",
            {
                "description": response.description,
                "detected": response.detected,
                "processing_time": response.processing_time,
                "timestamp": datetime.now().isoformat(),
            },
        )

        return response

    except HTTPException:
        # Re-raise HTTPExceptions to let FastAPI handle them
        raise
    except Exception as e:
        processing_time = (datetime.now() - start_time).total_seconds()
        # Handle specific error types for compatibility with tests
        error_message = str(e)
        if "Connection" in error_message or "connection" in error_message:
            error_message = f"Connection error: {str(e)}"
        elif "timeout" in error_message.lower():
            error_message = f"Analysis failed: {str(e)}"

        return ImageAnalysisResponse(
            description="",
            processing_time=processing_time,
            llm_model="gemini-1.5-flash",
            success=False,
            error_message=error_message,
        )


@server.post("/api/v1/ai/analyze-upload")
async def analyze_uploaded_image(
    file: UploadFile = File(...),
    prompt: Optional[str] = None,
):
    """
    Analyze an uploaded image file using AI workflow
    """
    try:
        # Read and encode the uploaded file
        image_data = await file.read()
        image_base64 = base64.b64encode(image_data).decode("utf-8")

        # Use the existing analysis endpoint
        request = ImageAnalysisRequest(image_base64=image_base64, prompt=prompt)

        return await analyze_image(request)

    except HTTPException:
        # Re-raise HTTPException to let FastAPI handle it properly
        raise
    except Exception as e:
        return ImageAnalysisResponse(
            description="",
            processing_time=0.0,
            llm_model="gemini-1.5-flash",
            success=False,
            error_message=f"File processing failed: {str(e)}",
        )


# All legacy LLaVA endpoints removed - no backward compatibility needed


@server.get("/api/v1/events/stream")
async def stream_events(request: Request):
    """
    Server-Sent Events endpoint for real-time updates
    """
    return await sse_manager.connect(request)


@server.get("/api/v1/events/connections")
def get_sse_connections():
    """
    Get information about active SSE connections
    """
    return {
        "connection_count": sse_manager.connection_count,
        "connected_clients": sse_manager.connected_clients,
    }


@server.get("/api/v1/queue/status")
def get_queue_status():
    """
    Get current queue status and drop statistics
    """
    # Queue manager removed - returning empty status
    return {
        "queue_size": 0,
        "max_size": 0,
        "drop_count": 0,
        "total_frames": 0,
        "message": "Queue manager not implemented",
    }


# Export for compatibility
app = server