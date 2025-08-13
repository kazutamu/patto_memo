import asyncio
import base64
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

import httpx
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

app = FastAPI()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# CORS configuration for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://localhost:3000",
        "*",
    ],  # Allow frontend
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
    prompt: str = Field(
        default="Describe what you see in this image", description="Analysis prompt"
    )


class LLaVAAnalysisResponse(BaseModel):
    description: str
    processing_time: float
    llm_model: (
        str  # Changed from model_used to avoid Pydantic's protected namespace "model_"
    )
    success: bool
    error_message: Optional[str] = None


@app.get("/health")
def health_check():
    return {"status": "ok"}


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
def create_motion_event(event: MotionEventCreate):
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


# SSE Models
class FrameAnalysisRequest(BaseModel):
    frame_id: str = Field(..., description="Unique identifier for the frame")
    frame_data: str = Field(..., description="Base64 encoded frame data")
    motion_strength: float = Field(..., description="Motion strength percentage")
    timestamp: str = Field(..., description="ISO timestamp of the frame")
    client_type: str = Field(default="sse", description="Client type identifier")


# Store active SSE connections
active_sse_connections = set()


@app.post("/api/v1/ai/analyze-frame")
async def analyze_frame_via_sse(request: FrameAnalysisRequest):
    """
    Accept frame for AI analysis and return acknowledgment
    Results will be sent via SSE to connected clients
    """
    logger.info(
        f"Received frame {request.frame_id} for analysis (Motion: {request.motion_strength}%)"
    )

    # For now, simulate immediate analysis and send via SSE
    # In production, this would queue the frame for background processing

    # Simulate AI analysis result
    analysis_result = {
        "type": "ai_analysis",
        "data": {
            "frame_id": request.frame_id,
            "description": f"Motion detected with {request.motion_strength:.1f}% intensity. Frame analyzed successfully.",
            "confidence": 0.85,
            "processing_time": 1.2,
            "timestamp": datetime.now().isoformat(),
            "motion_strength": request.motion_strength,
        },
        "timestamp": datetime.now().isoformat(),
    }

    # Send to all active SSE connections
    await broadcast_to_sse_clients(analysis_result)

    return {
        "status": "accepted",
        "frame_id": request.frame_id,
        "message": "Frame queued for analysis, results will be sent via SSE",
    }


async def broadcast_to_sse_clients(data: dict):
    """Broadcast data to all active SSE connections"""
    if not active_sse_connections:
        logger.info("No active SSE connections to broadcast to")
        return

    import json

    message = f"data: {json.dumps(data)}\n\n"

    # Send to all connections (in production, you'd track connection IDs)
    disconnected = set()
    for queue in active_sse_connections:
        try:
            await queue.put(message)
        except Exception:
            disconnected.add(queue)

    # Remove disconnected clients
    active_sse_connections.difference_update(disconnected)

    logger.info(f"Broadcasted message to {len(active_sse_connections)} SSE clients")


@app.get("/api/v1/ai/events")
async def ai_analysis_sse():
    """
    Server-Sent Events endpoint for real-time AI analysis results
    """
    import json
    import uuid

    connection_id = str(uuid.uuid4())[:8]
    logger.info(f"New SSE connection: {connection_id}")

    async def event_stream():
        # Create a queue for this connection
        queue = asyncio.Queue()
        active_sse_connections.add(queue)

        try:
            # Send initial connection message
            initial_message = {
                "type": "connection",
                "data": {"connection_id": connection_id, "status": "connected"},
                "timestamp": datetime.now().isoformat(),
            }
            yield f"data: {json.dumps(initial_message)}\n\n"

            # Send periodic pings and listen for analysis results
            while True:
                try:
                    # Wait for either a message or timeout for ping
                    message = await asyncio.wait_for(queue.get(), timeout=30.0)
                    yield message
                except asyncio.TimeoutError:
                    # Send ping to keep connection alive
                    ping_message = {
                        "type": "ping",
                        "timestamp": datetime.now().isoformat(),
                    }
                    yield f"data: {json.dumps(ping_message)}\n\n"

        except asyncio.CancelledError:
            logger.info(f"SSE connection {connection_id} cancelled")
        except Exception as e:
            logger.error(f"SSE connection {connection_id} error: {e}")
        finally:
            active_sse_connections.discard(queue)
            logger.info(f"SSE connection {connection_id} closed")

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # For nginx
        },
    )


@app.post("/api/v1/llava/analyze", response_model=LLaVAAnalysisResponse)
async def analyze_image_with_llava(request: LLaVAAnalysisRequest):
    """
    Analyze an image using LLaVA model via Ollama
    """
    start_time = datetime.now()

    try:
        # Ollama API endpoint (configurable via environment)
        ollama_url = "http://localhost:11434/api/generate"

        # Prepare the request payload for Ollama
        payload = {
            "model": "llava:latest",  # Default model, should be configurable
            "prompt": request.prompt,
            "images": [request.image_base64],
            "stream": False,
        }

        # Make request to Ollama
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(ollama_url, json=payload)

            if response.status_code != 200:
                raise HTTPException(
                    status_code=503,
                    detail=f"LLaVA service unavailable: {response.text}",
                )

            result = response.json()
            processing_time = (datetime.now() - start_time).total_seconds()

            return LLaVAAnalysisResponse(
                description=result.get("response", "No description available"),
                processing_time=processing_time,
                llm_model="llava:latest",
                success=True,
            )

    except httpx.RequestError as e:
        processing_time = (datetime.now() - start_time).total_seconds()
        return LLaVAAnalysisResponse(
            description="",
            processing_time=processing_time,
            llm_model="llava:latest",
            success=False,
            error_message=f"Connection error: {str(e)}",
        )
    except HTTPException:
        # Re-raise HTTPException to let FastAPI handle it properly
        raise
    except Exception as e:
        processing_time = (datetime.now() - start_time).total_seconds()
        return LLaVAAnalysisResponse(
            description="",
            processing_time=processing_time,
            llm_model="llava:latest",
            success=False,
            error_message=f"Analysis failed: {str(e)}",
        )


@app.post("/api/v1/llava/analyze-upload")
async def analyze_uploaded_image(
    file: UploadFile = File(...), prompt: str = "Describe what you see in this image"
):
    """
    Analyze an uploaded image file using LLaVA model
    """
    try:
        # Read and encode the uploaded file
        image_data = await file.read()
        image_base64 = base64.b64encode(image_data).decode("utf-8")

        # Use the existing analysis endpoint
        request = LLaVAAnalysisRequest(image_base64=image_base64, prompt=prompt)

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
