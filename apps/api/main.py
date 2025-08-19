import asyncio
import base64
import json
from datetime import datetime
from typing import Any, Dict, List, Optional

import httpx
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from graph import analyze_with_graph
from sse_manager import sse_manager

app = FastAPI()

# Configure CORS for SSE support
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dummy data store for motion events
dummy_motion_events = [
    {
        "id": 1,
        "timestamp": "2025-08-10T10:30:00Z",
        "confidence": 0.85,
        "duration": 2.3,
        "description": "Person detected at front entrance",
    },
    {
        "id": 2,
        "timestamp": "2025-08-10T11:15:30Z",
        "confidence": 0.72,
        "duration": 1.8,
        "description": "Animal movement in garden area",
    },
    {
        "id": 3,
        "timestamp": "2025-08-10T12:45:15Z",
        "confidence": 0.91,
        "duration": 3.1,
        "description": "Vehicle movement detected",
    },
]


# Pydantic models for request/response validation
class MotionEventCreate(BaseModel):
    confidence: float
    duration: float
    description: str = ""


class MotionEvent(BaseModel):
    id: int
    timestamp: str
    confidence: float
    duration: float
    description: str


class MotionSettings(BaseModel):
    detection_enabled: bool
    sensitivity: float
    min_confidence: float
    recording_enabled: bool
    alert_notifications: bool


class LLaVAAnalysisRequest(BaseModel):
    image_base64: str = Field(..., description="Base64 encoded image")
    prompt: Optional[str] = Field(
        default=None,
        description="Custom analysis prompt from user",
    )
    prompt_type: Optional[str] = Field(
        default="default",
        description="Type of analysis prompt: 'default', 'detailed', 'quick', or 'security'",
    )


class LLaVAAnalysisResponse(BaseModel):
    description: str
    detected: Optional[str] = None  # "YES" or "NO" for detection status
    processing_time: float
    llm_model: (
        str  # Changed from model_used to avoid Pydantic's protected namespace "model_"
    )
    success: bool
    error_message: Optional[str] = None


@app.get("/health")
def health_check():
    return {"status": "ok", "sse_connections": sse_manager.connection_count}


@app.get("/api/v1/motion/events", response_model=List[MotionEvent])
def get_motion_events(limit: int = 10):
    """
    Get recent motion detection events
    """
    # Validate limit parameter
    if limit < 0:
        raise HTTPException(status_code=422, detail="Limit must be non-negative")

    events = dummy_motion_events.copy()

    # Handle zero limit
    if limit == 0:
        return []

    # Apply limit
    events = events[-limit:]

    return events


@app.post("/api/v1/motion/events", response_model=MotionEvent)
async def create_motion_event(event: MotionEventCreate):
    """
    Report a new motion detection event
    """
    # Create new event with auto-generated ID and timestamp
    new_event = {
        "id": len(dummy_motion_events) + 1,
        "timestamp": datetime.now().isoformat() + "Z",
        "confidence": event.confidence,
        "duration": event.duration,
        "description": event.description,
    }

    # Add to dummy data store
    dummy_motion_events.append(new_event)

    # Broadcast motion event to SSE clients
    asyncio.create_task(
        sse_manager.broadcast(
            "motion_detected",
            {
                "id": new_event["id"],
                "confidence": new_event["confidence"],
                "duration": new_event["duration"],
                "description": new_event["description"],
                "timestamp": new_event["timestamp"],
            },
        )
    )

    return new_event


@app.get("/api/v1/motion/settings", response_model=MotionSettings)
def get_motion_settings():
    """
    Get current motion detection settings and configuration
    """
    return {
        "detection_enabled": True,
        "sensitivity": 0.7,
        "min_confidence": 0.6,
        "recording_enabled": True,
        "alert_notifications": True,
    }


@app.get("/api/v1/llava/prompts")
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
            "Are they exercising?"
        ]
    }


@app.post("/api/v1/llava/analyze", response_model=LLaVAAnalysisResponse)
async def analyze_image_with_llava(request: LLaVAAnalysisRequest):
    """
    Analyze an image using LangGraph workflow with LLaVA model
    """
    start_time = datetime.now()

    try:
        # Create JSON-formatted prompt
        json_format = 'Respond ONLY with valid JSON in this exact format: {"detected": "YES" or "NO", "description": "your answer"}.'
        
        if request.prompt:
            # User provided a custom prompt
            prompt = f'{json_format} Set detected to "YES" if the answer to the question is affirmative/positive or if activity is detected, "NO" otherwise. Answer this question: {request.prompt}'
        elif request.prompt_type == "detailed":
            prompt = f'{json_format} Set detected to "YES" if people are visible and active, "NO" if not. In description, describe in detail what each person is doing including: body position, what they are holding, specific actions, and any movements or gestures.'
        elif request.prompt_type == "quick":
            prompt = f'{json_format} Set detected to "YES" if activity is detected, "NO" if not. In description, briefly state what specific activity the person is performing.'
        elif request.prompt_type == "security":
            prompt = f'{json_format} Set detected to "YES" if there is any security concern, "NO" if normal. In description, analyze from a security perspective what the person is doing and whether their behavior is normal or suspicious.'
        else:
            # Default prompt
            prompt = f'{json_format} Set detected to "YES" if motion/activity is detected, "NO" if not. In description, analyze what the person is doing, focusing on their actions, posture, and activities. Be specific about movements, gestures, or tasks being performed.'

        # Use LangGraph
        graph_result = await analyze_with_graph(request.image_base64, prompt)
        processing_time = (datetime.now() - start_time).total_seconds()

        # Check if graph returned error information
        if isinstance(graph_result, dict) and "error_type" in graph_result:
            if graph_result["error_type"] == "service_unavailable":
                raise HTTPException(status_code=503, detail="Service unavailable")

            # Return error response for other error types
            return LLaVAAnalysisResponse(
                description="",
                processing_time=processing_time,
                llm_model="llava:latest",
                success=False,
                error_message=graph_result.get("error_message", "Unknown error"),
            )

        # Handle successful response
        result_text = (
            graph_result
            if isinstance(graph_result, str)
            else graph_result.get("result", "")
        )

        # Try to parse JSON response to extract detection status
        detected_status = None
        description_text = result_text
        
        try:
            parsed_result = json.loads(result_text)
            if isinstance(parsed_result, dict):
                detected_status = parsed_result.get("detected", None)
                description_text = parsed_result.get("description", result_text)
        except (json.JSONDecodeError, AttributeError):
            # If not valid JSON, use the raw text as description
            pass

        response = LLaVAAnalysisResponse(
            description=description_text,
            detected=detected_status,
            processing_time=processing_time,
            llm_model="llava:latest",
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

        return LLaVAAnalysisResponse(
            description="",
            processing_time=processing_time,
            llm_model="llava:latest",
            success=False,
            error_message=error_message,
        )


@app.post("/api/v1/llava/analyze-upload")
async def analyze_uploaded_image(
    file: UploadFile = File(...),
    prompt: Optional[str] = None,
    prompt_type: str = "default",
):
    """
    Analyze an uploaded image file using LangGraph workflow
    """
    try:
        # Read and encode the uploaded file
        image_data = await file.read()
        image_base64 = base64.b64encode(image_data).decode("utf-8")

        # Use the existing analysis endpoint
        request = LLaVAAnalysisRequest(
            image_base64=image_base64, prompt=prompt, prompt_type=prompt_type
        )

        return await analyze_image_with_llava(request)

    except HTTPException:
        # Re-raise HTTPException to let FastAPI handle it properly
        raise
    except Exception as e:
        return LLaVAAnalysisResponse(
            description="",
            processing_time=0.0,
            llm_model="llava:latest",
            success=False,
            error_message=f"File processing failed: {str(e)}",
        )


@app.get("/api/v1/events/stream")
async def stream_events(request: Request):
    """
    Server-Sent Events endpoint for real-time updates
    """
    return await sse_manager.connect(request)


@app.get("/api/v1/events/connections")
def get_sse_connections():
    """
    Get information about active SSE connections
    """
    return {
        "connection_count": sse_manager.connection_count,
        "connected_clients": sse_manager.connected_clients,
    }


@app.get("/api/v1/queue/status")
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
