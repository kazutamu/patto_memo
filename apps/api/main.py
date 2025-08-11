import asyncio
import base64
import json
import logging
import os
import random
from datetime import datetime
from typing import Any, Dict, List, Optional

import httpx
import redis.asyncio as redis
from fastapi import FastAPI, File, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

from ai_processor import ai_processor

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Store active WebSocket connections
active_connections: Dict[str, WebSocket] = {}

# Redis client for pub/sub
redis_client: Optional[redis.Redis] = None

# Background tasks
background_tasks = []

@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    global redis_client
    
    try:
        # Connect to Redis
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        redis_client = await redis.from_url(
            redis_url,
            encoding="utf-8",
            decode_responses=True
        )
        await redis_client.ping()
        logger.info("Connected to Redis")
        
        # Start AI processor worker
        worker_task = asyncio.create_task(ai_processor.start_worker())
        background_tasks.append(worker_task)
        logger.info("Started AI processor worker")
        
        # Start Redis subscriber for AI results
        subscriber_task = asyncio.create_task(subscribe_to_ai_results())
        background_tasks.append(subscriber_task)
        logger.info("Started AI results subscriber")
        
    except Exception as e:
        logger.error(f"Startup error: {e}")
        logger.warning("Running without Redis/AI processing support")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    # Cancel background tasks
    for task in background_tasks:
        task.cancel()
    
    # Wait for tasks to complete
    await asyncio.gather(*background_tasks, return_exceptions=True)
    
    # Close Redis connection
    if redis_client:
        await redis_client.close()
    
    # Disconnect AI processor
    await ai_processor.disconnect()
    
    logger.info("Shutdown complete")

async def subscribe_to_ai_results():
    """Subscribe to AI analysis results and forward to WebSocket clients"""
    if not redis_client:
        return
        
    pubsub = redis_client.pubsub()
    await pubsub.subscribe("ai_analysis_results")
    
    try:
        async for message in pubsub.listen():
            if message["type"] == "message":
                try:
                    result = json.loads(message["data"])
                    websocket_id = result.get("data", {}).get("websocket_id")
                    
                    # Send to specific WebSocket connection
                    if websocket_id in active_connections:
                        websocket = active_connections[websocket_id]
                        await websocket.send_text(json.dumps(result))
                        logger.info(f"Sent AI result to WebSocket {websocket_id}")
                        
                except Exception as e:
                    logger.error(f"Error forwarding AI result: {e}")
                    
    except asyncio.CancelledError:
        await pubsub.unsubscribe("ai_analysis_results")
        await pubsub.close()

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


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for real-time motion detection and AI analysis
    """
    import uuid
    
    await websocket.accept()
    
    # Generate unique ID for this WebSocket connection
    websocket_id = str(uuid.uuid4())
    active_connections[websocket_id] = websocket
    
    logger.info(f"WebSocket client connected: {websocket_id}")
    
    try:
        while True:
            # Receive motion event from client
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Handle both message formats (frontend sends 'type', we check both)
            message_type = message.get('type') or message.get('event_type')
            logger.debug(f"Received message type: {message_type} from {websocket_id}")
            
            # Handle ping messages for keep-alive
            if message_type == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
                continue
            
            # If it's a motion event with frame data, queue for AI analysis
            if message_type == "motion_event":
                # Extract motion event data from the message
                motion_data = message.get('data', {}) if 'data' in message else message
                frame_id = motion_data.get("frame_id", f"frame_{uuid.uuid4()}")
                motion_strength = motion_data.get("motion_strength", 0)
                frame_data = motion_data.get("frame_data", "")
                
                logger.info(f"Received motion event {frame_id} with {motion_strength}% strength")
                
                # Queue for background processing if frame data is available
                if frame_data and motion_strength > 0:
                    # Use background AI processor (non-blocking)
                    queued = await ai_processor.queue_frame_for_analysis(
                        frame_id=frame_id,
                        frame_data=frame_data,
                        motion_strength=motion_strength,
                        websocket_id=websocket_id
                    )
                    
                    if queued:
                        # Send immediate acknowledgment
                        ack_message = {
                            "type": "motion_ack",
                            "data": {
                                "frame_id": frame_id,
                                "status": "queued",
                                "message": "Frame queued for AI analysis"
                            },
                            "timestamp": datetime.now().isoformat()
                        }
                        await websocket.send_text(json.dumps(ack_message))
                    else:
                        # If queueing failed, try direct processing as fallback
                        logger.warning(f"Failed to queue frame {frame_id}, attempting direct processing")
                        
                        # Fallback to simple response
                        fallback_result = {
                            "type": "ai_analysis",
                            "data": {
                                "frame_id": frame_id,
                                "description": f"Motion detected ({motion_strength:.1f}% strength) - Analysis pending",
                                "confidence": 0.5,
                                "processing_time": 0,
                                "timestamp": datetime.now().isoformat(),
                            },
                            "timestamp": datetime.now().isoformat(),
                        }
                        await websocket.send_text(json.dumps(fallback_result))
                
    except WebSocketDisconnect:
        logger.info(f"WebSocket client disconnected: {websocket_id}")
    except Exception as e:
        logger.error(f"WebSocket error for {websocket_id}: {e}")
    finally:
        # Remove from active connections
        if websocket_id in active_connections:
            del active_connections[websocket_id]
        try:
            await websocket.close()
        except:
            pass