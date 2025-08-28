import base64
import os
from datetime import datetime
from typing import List, Optional

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from gemini_analyzer import analyze_with_gemini
from sse_manager import sse_manager

app = FastAPI(
    title="Motion Detector API",
    description="AI-powered motion detection and analysis API",
    version="1.0.0",
)


# Dynamic CORS configuration
def is_allowed_origin(origin: str) -> bool:
    """Check if origin is allowed using pattern matching"""
    if not origin:
        return False

    allowed_patterns = [
        # Cloudflare Pages - any branch or main deployment
        r"https://.*\.patto-memo\.pages\.dev",
        # Main production domain
        r"https://patto-memo\.pages\.dev",
        # Local development
        r"http://localhost:\d+",
        r"http://127\.0\.0\.1:\d+",
    ]

    import re

    for pattern in allowed_patterns:
        if re.match(pattern, origin):
            return True
    return False


# Get allowed origins from environment variable for production security
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "")
if allowed_origins_env:
    # If ALLOWED_ORIGINS is set, use it (split by comma)
    allowed_origins = [origin.strip() for origin in allowed_origins_env.split(",")]
else:
    # Use dynamic pattern matching
    allowed_origins = ["*"]  # Will be filtered by custom middleware

# Configure CORS for SSE support
if allowed_origins_env:
    # Use explicit origins from environment
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )
else:
    # Use dynamic origin checking
    from fastapi.middleware.cors import CORSMiddleware
    from starlette.middleware.base import BaseHTTPMiddleware
    from starlette.requests import Request
    from starlette.responses import Response

    class DynamicCORSMiddleware(BaseHTTPMiddleware):
        async def dispatch(self, request: Request, call_next):
            origin = request.headers.get("origin")

            # Handle preflight requests
            if request.method == "OPTIONS":
                if origin and is_allowed_origin(origin):
                    response = Response()
                    response.headers["Access-Control-Allow-Origin"] = origin
                    response.headers["Access-Control-Allow-Methods"] = (
                        "GET, POST, OPTIONS"
                    )
                    response.headers["Access-Control-Allow-Headers"] = "*"
                    response.headers["Access-Control-Allow-Credentials"] = "true"
                    return response
                else:
                    return Response(status_code=403)

            # Handle actual requests
            response = await call_next(request)

            if origin and is_allowed_origin(origin):
                response.headers["Access-Control-Allow-Origin"] = origin
                response.headers["Access-Control-Allow-Credentials"] = "true"

            return response

    app.add_middleware(DynamicCORSMiddleware)


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


class TodoGenerationRequest(BaseModel):
    images_base64: List[str] = Field(..., description="List of base64 encoded images")
    context: Optional[str] = Field(
        default="Generate todo items based on what the user wanted to remember from these images",
        description="Context for todo generation",
    )


class TodoItem(BaseModel):
    id: str
    task: str
    priority: str  # "high", "medium", "low"
    category: Optional[str] = None
    estimated_time: Optional[str] = None


class TodoGenerationResponse(BaseModel):
    todos: List[TodoItem]
    summary: str
    processing_time: float
    llm_model: str
    success: bool
    error_message: Optional[str] = None


@app.get("/health")
def health_check():
    return {"status": "ok", "sse_connections": sse_manager.connection_count}


@app.get("/api/v1/health")
def health_check_v1():
    """Health check endpoint for API v1 compatibility"""
    return {"status": "ok", "sse_connections": sse_manager.connection_count}


@app.get("/api/v1/ai/prompts")
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


@app.post("/api/v1/ai/analyze-image", response_model=ImageAnalysisResponse)
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


@app.post("/api/v1/ai/analyze-upload")
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


@app.post("/api/v1/ai/generate-todos", response_model=TodoGenerationResponse)
async def generate_todos_from_images(request: TodoGenerationRequest):
    """
    Generate todo items from multiple images using AI analysis
    """
    start_time = datetime.now()

    try:
        if not request.images_base64:
            return TodoGenerationResponse(
                todos=[],
                summary="No images provided",
                processing_time=0.0,
                llm_model="gemini-1.5-flash",
                success=False,
                error_message="At least one image is required",
            )

        # Create a comprehensive prompt for item listing
        todo_prompt = f"""
        Analyze these {len(request.images_base64)} images and create a detailed list of ALL visible items, objects, text, and elements you can see.

        List EVERYTHING visible in the images:
        - Physical objects (furniture, tools, food items, documents, etc.)
        - Text content (labels, signs, writing, numbers, etc.)
        - People and their clothing/accessories
        - Background elements and scenery
        - Any readable information or details
        - Electronic devices, screens, displays
        - Natural elements (plants, animals, weather, etc.)

        For each item, provide:
        1. A clear description of what you see
        2. Location/context within the image if relevant
        3. Category the item belongs to

        Be thorough and comprehensive - don't make assumptions about what the user wants to remember, just list everything you can observe in detail.

        Format your response as a detailed inventory of visible items.

        Context: {request.context}
        """

        # Use the first image for the main analysis, but mention multiple images in prompt
        gemini_result = await analyze_with_gemini(request.images_base64[0], todo_prompt)

        if not gemini_result["success"]:
            return TodoGenerationResponse(
                todos=[],
                summary="Failed to analyze images",
                processing_time=gemini_result["processing_time"],
                llm_model=gemini_result["llm_model"],
                success=False,
                error_message=gemini_result["error_message"],
            )

        # Parse the AI response to extract todo items
        # For now, we'll create a simple parser - in production you might want more sophisticated parsing
        ai_response = gemini_result["description"]
        
        # Parse items from the AI response - look for any listed items
        import re
        import uuid
        
        todo_items = []
        lines = ai_response.split('\n')
        
        for line in lines:
            line = line.strip()
            # Look for any line that appears to be listing an item
            if line and (line.startswith('-') or line.startswith('•') or line.startswith('*') or 
                        re.match(r'^\d+\.', line) or ':' in line):
                # Clean up the line
                cleaned_line = re.sub(r'^[-•*\d\.]\s*', '', line)
                if len(cleaned_line) > 3:  # Ensure it's substantial enough
                    # All items are treated as observations, no priority needed
                    priority = "medium"
                    
                    # Determine category based on content
                    category = "observed"
                    if any(word in cleaned_line.lower() for word in ['food', 'drink', 'eat', 'meal', 'kitchen', 'cooking']):
                        category = "food"
                    elif any(word in cleaned_line.lower() for word in ['book', 'paper', 'document', 'text', 'writing', 'sign']):
                        category = "text"
                    elif any(word in cleaned_line.lower() for word in ['person', 'man', 'woman', 'people', 'clothing', 'shirt', 'hat']):
                        category = "people"
                    elif any(word in cleaned_line.lower() for word in ['furniture', 'table', 'chair', 'desk', 'shelf', 'cabinet']):
                        category = "furniture"
                    elif any(word in cleaned_line.lower() for word in ['device', 'phone', 'computer', 'screen', 'electronic', 'gadget']):
                        category = "electronics"
                    elif any(word in cleaned_line.lower() for word in ['plant', 'tree', 'flower', 'nature', 'outdoor', 'sky']):
                        category = "nature"
                    elif any(word in cleaned_line.lower() for word in ['tool', 'equipment', 'machine', 'instrument']):
                        category = "tools"
                    
                    todo_items.append(TodoItem(
                        id=str(uuid.uuid4())[:8],
                        task=cleaned_line,
                        priority=priority,
                        category=category,
                        estimated_time=None
                    ))

        # If no structured items found, split response into sentences and create items
        if not todo_items and ai_response:
            sentences = [s.strip() for s in ai_response.replace('.', '\n').split('\n') if s.strip() and len(s.strip()) > 10]
            for i, sentence in enumerate(sentences[:10]):  # Limit to 10 items
                todo_items.append(TodoItem(
                    id=str(uuid.uuid4())[:8],
                    task=sentence,
                    priority="medium",
                    category="observed"
                ))

        processing_time = (datetime.now() - start_time).total_seconds()

        return TodoGenerationResponse(
            todos=todo_items,
            summary=f"Found {len(todo_items)} visible items in {len(request.images_base64)} image{'s' if len(request.images_base64) > 1 else ''}",
            processing_time=processing_time,
            llm_model=gemini_result["llm_model"],
            success=True,
        )

    except HTTPException:
        raise
    except Exception as e:
        processing_time = (datetime.now() - start_time).total_seconds()
        return TodoGenerationResponse(
            todos=[],
            summary="Error processing images",
            processing_time=processing_time,
            llm_model="gemini-1.5-flash",
            success=False,
            error_message=str(e),
        )


# All legacy LLaVA endpoints removed - no backward compatibility needed


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
