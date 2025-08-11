import asyncio
import base64
import json
import random
from datetime import datetime
from typing import Any, Dict, List, Optional

import httpx
from fastapi import FastAPI, File, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

app = FastAPI()

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
    await websocket.accept()
    print("WebSocket client connected")
    
    try:
        while True:
            # Receive motion event from client
            data = await websocket.receive_text()
            motion_data = json.loads(data)
            
            print(f"Received motion event: {motion_data.get('event_type', 'unknown')}")
            
            # If it's a motion event with frame data, simulate AI analysis
            if motion_data.get("event_type") == "motion_event":
                frame_id = motion_data.get("frame_id", "unknown")
                motion_strength = motion_data.get("motion_strength", 0)
                
                print(f"Processing AI analysis for frame {frame_id} with motion strength {motion_strength}%")
                
                # Simulate processing delay (LLaVA would take 2-5 seconds)
                await asyncio.sleep(random.uniform(2, 4))
                
                # Generate simulated AI analysis response
                ai_responses = [
                    "A person wearing a blue shirt is walking through the frame from left to right",
                    "Multiple people detected having a conversation near the entrance",
                    "A delivery person approaching with a package in hand",
                    "A cat is moving across the garden area",
                    "A vehicle is parking in the driveway",
                    "Wind causing tree branches to move significantly",
                    "Someone is waving at the camera",
                    "A person carrying groceries towards the door",
                ]
                
                analysis_result = {
                    "event_type": "ai_analysis",
                    "frame_id": frame_id,
                    "description": random.choice(ai_responses),
                    "confidence": round(random.uniform(0.7, 0.95), 2),
                    "processing_time": round(random.uniform(2, 4), 2),
                    "timestamp": datetime.now().isoformat(),
                    "objects_detected": random.randint(1, 3),
                }
                
                # Send AI analysis back to client
                await websocket.send_text(json.dumps(analysis_result))
                print(f"Sent AI analysis for frame {frame_id}: {analysis_result['description'][:50]}...")
                
    except WebSocketDisconnect:
        print("WebSocket client disconnected")
    except Exception as e:
        print(f"WebSocket error: {e}")
        await websocket.close()