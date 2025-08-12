import asyncio
import base64
import json
import logging
import os
import random
from datetime import datetime
from typing import Any, Dict, List, Optional, AsyncGenerator
import uuid

import httpx
import redis.asyncio as redis
from fastapi import FastAPI, File, HTTPException, UploadFile, Request
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from ai_processor import ai_processor

# Store for polling-based AI analysis results
polling_results = {}  # frame_id -> result

# Store for SSE connections
class SSEConnection:
    def __init__(self, connection_id: str, queue: asyncio.Queue):
        self.connection_id = connection_id
        self.queue = queue
        self.created_at = datetime.now()

sse_connections: Dict[str, SSEConnection] = {}

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Configure CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Removed WebSocket connections - now using SSE

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
    """Subscribe to AI analysis results and forward to SSE clients"""
    if not redis_client:
        return
        
    pubsub = redis_client.pubsub()
    await pubsub.subscribe("ai_analysis_results")
    
    try:
        async for message in pubsub.listen():
            if message["type"] == "message":
                try:
                    result = json.loads(message["data"])
                    
                    # Send to SSE connections
                    if result.get("data"):
                        await send_to_sse_connections(result.get("data"))
                        
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


class FrameAnalysisRequest(BaseModel):
    frame_id: str
    frame_data: str = Field(..., description="Base64 encoded image")
    motion_strength: float
    timestamp: str
    client_type: str = "web"


class FrameAnalysisResponse(BaseModel):
    frame_id: str
    status: str  # queued, processing, completed, failed
    analysis: Optional[Dict] = None
    message: Optional[str] = None


class PollResultsRequest(BaseModel):
    frame_ids: List[str]


class PollResultsResponse(BaseModel):
    completed: List[Dict]
    failed: List[str]
    pending: List[str]


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


@app.post("/api/v1/ai/analyze-frame", response_model=FrameAnalysisResponse)
async def analyze_frame_polling(request: FrameAnalysisRequest):
    """
    Submit a frame for AI analysis via polling (mobile-friendly)
    """
    logger.info(f"📱 Received frame for polling analysis: {request.frame_id}")
    
    try:
        # Try direct analysis first (if Redis/Ollama available)
        if hasattr(ai_processor, 'process_frame_with_llava'):
            result = await ai_processor.process_frame_with_llava(
                request.frame_data,
                request.motion_strength
            )
            
            if result.get("success"):
                # Return immediate result
                analysis_data = {
                    "frame_id": request.frame_id,
                    "description": result["description"],
                    "confidence": result["confidence"],
                    "processing_time": 0,  # Immediate
                    "timestamp": datetime.now().isoformat(),
                }
                
                return FrameAnalysisResponse(
                    frame_id=request.frame_id,
                    status="completed",
                    analysis=analysis_data,
                    message="Analysis completed immediately"
                )
        
        # Fallback: Store for polling
        polling_results[request.frame_id] = {
            "status": "processing",
            "submitted_at": datetime.now().isoformat(),
            "client_type": request.client_type
        }
        
        # Simulate processing (in real app, this would queue the job)
        import asyncio
        
        async def process_later():
            await asyncio.sleep(3)  # Simulate processing time
            
            # Simple analysis result
            analysis_data = {
                "frame_id": request.frame_id,
                "description": f"Motion detected ({request.motion_strength:.1f}% strength) - AI analysis via SSE",
                "confidence": 0.8,
                "processing_time": 3000,
                "timestamp": datetime.now().isoformat(),
            }
            
            # Store for polling (backward compatibility)
            polling_results[request.frame_id] = {
                "status": "completed",
                "analysis": analysis_data,
                "completed_at": datetime.now().isoformat()
            }
            
            # Send to SSE connections
            await send_to_sse_connections(analysis_data)
            
        # Start background processing
        asyncio.create_task(process_later())
        
        return FrameAnalysisResponse(
            frame_id=request.frame_id,
            status="queued",
            message="Frame queued for analysis"
        )
        
    except Exception as e:
        logger.error(f"Error processing frame {request.frame_id}: {e}")
        return FrameAnalysisResponse(
            frame_id=request.frame_id,
            status="failed",
            message=f"Analysis failed: {str(e)}"
        )


# SSE Helper Functions
def create_sse_response(data: dict, event: str = None) -> str:
    """Format data as Server-Sent Event"""
    message_lines = []
    
    if event:
        message_lines.append(f"event: {event}")
    
    message_lines.append(f"data: {json.dumps(data)}")
    message_lines.append("")  # Empty line to end the event
    
    return "\n".join(message_lines) + "\n"

async def send_to_sse_connections(result: dict):
    """Send AI analysis result to all active SSE connections"""
    if not sse_connections:
        return
        
    # Format the result for SSE
    sse_event = {
        "type": "ai_analysis",
        "data": result,
        "timestamp": datetime.now().isoformat()
    }
    
    # Send to all connections
    disconnected_connections = []
    
    for connection_id, connection in sse_connections.items():
        try:
            await connection.queue.put(sse_event)
            logger.debug(f"Sent AI result to SSE connection {connection_id}")
        except Exception as e:
            logger.error(f"Failed to send to SSE connection {connection_id}: {e}")
            disconnected_connections.append(connection_id)
    
    # Clean up failed connections
    for connection_id in disconnected_connections:
        del sse_connections[connection_id]

@app.get("/api/v1/ai/events")
async def ai_analysis_stream(request: Request):
    """
    SSE endpoint for streaming AI analysis results
    """
    # Generate unique connection ID
    connection_id = str(uuid.uuid4())
    
    # Create connection queue
    connection_queue = asyncio.Queue()
    connection = SSEConnection(connection_id, connection_queue)
    sse_connections[connection_id] = connection
    
    logger.info(f"SSE connection established: {connection_id}")
    
    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            # Send connection established event
            initial_event = create_sse_response({
                "connection_id": connection_id,
                "message": "Connected to AI analysis stream",
                "timestamp": datetime.now().isoformat()
            }, "connected")
            yield initial_event
            
            # Keep connection alive and send events
            while True:
                try:
                    # Wait for events with timeout for keep-alive
                    event_data = await asyncio.wait_for(
                        connection.queue.get(), 
                        timeout=30.0
                    )
                    
                    # Send the event
                    sse_message = create_sse_response(event_data, event_data.get("type", "data"))
                    yield sse_message
                    
                except asyncio.TimeoutError:
                    # Send keep-alive ping
                    ping_event = create_sse_response({
                        "type": "ping",
                        "timestamp": datetime.now().isoformat()
                    }, "ping")
                    yield ping_event
                    
        except asyncio.CancelledError:
            logger.info(f"SSE connection cancelled: {connection_id}")
            raise
            
        except Exception as e:
            error_event = create_sse_response({
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }, "error")
            yield error_event
            
        finally:
            # Clean up connection
            if connection_id in sse_connections:
                del sse_connections[connection_id]
                logger.info(f"SSE connection closed: {connection_id}")
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "X-Accel-Buffering": "no"  # Disable Nginx buffering
        }
    )

@app.post("/api/v1/ai/poll-results", response_model=PollResultsResponse)
async def poll_analysis_results(request: PollResultsRequest):
    """
    Poll for analysis results (mobile-friendly)
    """
    completed = []
    failed = []
    pending = []
    
    for frame_id in request.frame_ids:
        if frame_id in polling_results:
            result = polling_results[frame_id]
            
            if result["status"] == "completed":
                completed.append(result["analysis"])
                # Clean up completed results
                del polling_results[frame_id]
                
            elif result["status"] == "failed":
                failed.append(frame_id)
                # Clean up failed results
                del polling_results[frame_id]
                
            else:
                pending.append(frame_id)
        else:
            # Unknown frame ID
            failed.append(frame_id)
    
    logger.debug(f"📱 Polling results: {len(completed)} completed, {len(pending)} pending, {len(failed)} failed")
    
    return PollResultsResponse(
        completed=completed,
        failed=failed,
        pending=pending
    )


# WebSocket endpoint removed - now using SSE for real-time communication