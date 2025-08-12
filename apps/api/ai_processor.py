"""
Background AI processing service for motion detection frames
Handles LLaVA analysis asynchronously to prevent WebSocket blocking
"""

import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, Optional

import httpx
import redis.asyncio as redis

logger = logging.getLogger(__name__)


class AIProcessor:
    """
    Handles background AI analysis processing using Redis as a job queue
    """
    
    def __init__(
        self,
        redis_url: str = "redis://localhost:6379/0",
        ollama_url: str = "http://localhost:11434",
    ):
        self.redis_url = redis_url
        self.ollama_url = ollama_url
        self.redis_client: Optional[redis.Redis] = None
        self.processing_queue = "motion_frames_queue"
        self.results_channel = "ai_analysis_results"
        
    async def connect(self):
        """Connect to Redis"""
        try:
            self.redis_client = await redis.from_url(
                self.redis_url,
                encoding="utf-8",
                decode_responses=True
            )
            await self.redis_client.ping()
            logger.info("Connected to Redis for AI processing")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            raise
            
    async def disconnect(self):
        """Disconnect from Redis"""
        if self.redis_client:
            await self.redis_client.close()
            
    async def queue_frame_for_analysis(
        self,
        frame_id: str,
        frame_data: str,
        motion_strength: float,
        websocket_id: str
    ) -> bool:
        """
        Queue a frame for background AI analysis
        
        Args:
            frame_id: Unique identifier for the frame
            frame_data: Base64 encoded frame data
            motion_strength: Detected motion strength percentage
            websocket_id: ID of the WebSocket connection to send results to
            
        Returns:
            True if successfully queued, False otherwise
        """
        if not self.redis_client:
            await self.connect()
            
        try:
            job_data = {
                "frame_id": frame_id,
                "frame_data": frame_data,
                "motion_strength": motion_strength,
                "websocket_id": websocket_id,
                "queued_at": datetime.now().isoformat(),
            }
            
            # Add to processing queue
            await self.redis_client.lpush(
                self.processing_queue,
                json.dumps(job_data)
            )
            
            logger.info(f"Queued frame {frame_id} for AI analysis")
            return True
            
        except Exception as e:
            logger.error(f"Failed to queue frame {frame_id}: {e}")
            return False
            
    async def process_frame_with_llava(
        self,
        frame_data: str,
        motion_strength: float
    ) -> Dict:
        """
        Process a frame with LLaVA model
        
        Args:
            frame_data: Base64 encoded frame data
            motion_strength: Detected motion strength
            
        Returns:
            Analysis result dictionary
        """
        try:
            # Prepare the LLaVA request
            prompt = (
                f"You are analyzing a security camera frame with {motion_strength:.1f}% motion detected. "
                "Describe what you see, focusing on any people, vehicles, animals, or notable activities. "
                "Be specific and concise, mentioning directions of movement if applicable."
            )
            
            payload = {
                "model": "llava:latest",
                "prompt": prompt,
                "images": [frame_data],
                "stream": False,
                "options": {
                    "temperature": 0.3,  # Lower temperature for more consistent descriptions
                    "num_predict": 150,  # Limit response length
                }
            }
            
            # Make request to Ollama
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.ollama_url}/api/generate",
                    json=payload
                )
                
                if response.status_code == 200:
                    result = response.json()
                    description = result.get("response", "").strip()
                    
                    # Calculate confidence based on response quality
                    if description and len(description) > 30:
                        # Good detailed response
                        confidence = min(0.95, 0.7 + (motion_strength / 100) * 0.25)
                    else:
                        # Short or empty response
                        confidence = 0.5
                        
                    return {
                        "success": True,
                        "description": description or f"Motion detected ({motion_strength:.1f}% strength)",
                        "confidence": round(confidence, 2),
                        "model": "llava:latest",
                    }
                else:
                    logger.error(f"LLaVA returned status {response.status_code}")
                    return {
                        "success": False,
                        "description": f"AI analysis unavailable (motion: {motion_strength:.1f}%)",
                        "confidence": 0.5,
                        "error": f"HTTP {response.status_code}",
                    }
                    
        except httpx.TimeoutException:
            logger.error("LLaVA request timed out")
            return {
                "success": False,
                "description": f"Analysis timeout (motion: {motion_strength:.1f}%)",
                "confidence": 0.5,
                "error": "Timeout",
            }
        except Exception as e:
            logger.error(f"LLaVA processing error: {e}")
            return {
                "success": False,
                "description": f"Analysis failed (motion: {motion_strength:.1f}%)",
                "confidence": 0.5,
                "error": str(e),
            }
            
    async def worker(self):
        """
        Background worker that processes frames from the queue
        """
        logger.info("AI processing worker started")
        
        if not self.redis_client:
            await self.connect()
            
        while True:
            try:
                # Get next job from queue (blocking pop with 1 second timeout)
                job_json = await self.redis_client.brpop(
                    self.processing_queue,
                    timeout=1
                )
                
                if not job_json:
                    continue
                    
                # Parse job data
                job_data = json.loads(job_json[1])
                frame_id = job_data["frame_id"]
                frame_data = job_data["frame_data"]
                motion_strength = job_data["motion_strength"]
                websocket_id = job_data["websocket_id"]
                
                logger.info(f"Processing frame {frame_id}")
                start_time = datetime.now()
                
                # Process with LLaVA
                result = await self.process_frame_with_llava(
                    frame_data,
                    motion_strength
                )
                
                processing_time = (datetime.now() - start_time).total_seconds()
                
                # Prepare analysis result
                analysis_result = {
                    "type": "ai_analysis",
                    "data": {
                        "frame_id": frame_id,
                        "description": result["description"],
                        "confidence": result["confidence"],
                        "processing_time": round(processing_time * 1000, 2),  # ms
                        "timestamp": datetime.now().isoformat(),
                        "websocket_id": websocket_id,
                    },
                    "timestamp": datetime.now().isoformat(),
                }
                
                # Publish result to Redis channel for WebSocket delivery
                await self.redis_client.publish(
                    self.results_channel,
                    json.dumps(analysis_result)
                )
                
                logger.info(
                    f"Completed analysis for frame {frame_id} in {processing_time:.2f}s"
                )
                
            except asyncio.CancelledError:
                logger.info("AI processing worker cancelled")
                break
            except Exception as e:
                logger.error(f"Worker error: {e}")
                await asyncio.sleep(1)  # Brief pause before retrying
                
    async def start_worker(self):
        """
        Start the background worker task
        """
        try:
            await self.worker()
        except Exception as e:
            logger.error(f"Worker crashed: {e}")
        finally:
            await self.disconnect()


# Singleton instance
ai_processor = AIProcessor()