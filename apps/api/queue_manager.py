import asyncio
import time
from collections import deque
from datetime import datetime
from typing import Dict, Optional

from pydantic import BaseModel


class QueuedFrame(BaseModel):
    image_base64: str
    prompt: str
    prompt_type: str
    timestamp: float
    priority: int = 0


class QueueManager:
    def __init__(self, max_size: int = 10, drop_threshold: int = 5):
        self.queue: deque = deque(maxlen=max_size)
        self.drop_threshold = drop_threshold
        self.processing_times: deque = deque(maxlen=20)
        self.last_frame_time = 0
        self.min_frame_interval = 0.5  # Minimum seconds between frames
        self._lock = asyncio.Lock()
        self.processing_active = False
        
    async def add_frame(self, frame: QueuedFrame) -> bool:
        """Add frame to queue with intelligent dropping"""
        async with self._lock:
            current_time = time.time()
            queue_size = len(self.queue)
            
            # Drop immediately if processing is slow and queue is full
            if self.processing_active and queue_size >= self.drop_threshold:
                return False
            
            # Calculate drop rate based on queue depth
            if queue_size >= self.drop_threshold:
                # Drop frames more aggressively as queue fills
                drop_rate = min(0.8, (queue_size - self.drop_threshold) / self.drop_threshold)
                time_since_last = current_time - self.last_frame_time
                
                # Skip frame based on drop rate and time
                if time_since_last < self.min_frame_interval * (1 + drop_rate * 4):
                    return False
            
            # Add frame with priority (newer frames have higher priority)
            frame.priority = int(current_time * 1000)
            self.queue.append(frame)
            self.last_frame_time = current_time
            return True
    
    async def get_frame(self) -> Optional[QueuedFrame]:
        """Get highest priority frame from queue"""
        async with self._lock:
            if not self.queue:
                return None
            
            # Sort by priority and get newest frame
            sorted_queue = sorted(self.queue, key=lambda x: x.priority, reverse=True)
            frame = sorted_queue[0]
            self.queue.remove(frame)
            return frame
    
    def get_queue_status(self) -> Dict:
        """Get current queue statistics"""
        avg_processing = (
            sum(self.processing_times) / len(self.processing_times)
            if self.processing_times
            else 0
        )
        
        return {
            "queue_size": len(self.queue),
            "drop_threshold": self.drop_threshold,
            "is_dropping": len(self.queue) >= self.drop_threshold,
            "drop_rate": self._calculate_drop_rate(),
            "avg_processing_time": avg_processing,
        }
    
    def _calculate_drop_rate(self) -> float:
        """Calculate current frame drop rate"""
        queue_size = len(self.queue)
        if queue_size < self.drop_threshold:
            return 0.0
        return min(0.8, (queue_size - self.drop_threshold) / self.drop_threshold)
    
    def record_processing_time(self, processing_time: float):
        """Record processing time for statistics"""
        self.processing_times.append(processing_time)
    
    async def start_processing(self):
        """Mark processing as active"""
        async with self._lock:
            self.processing_active = True
    
    async def end_processing(self):
        """Mark processing as inactive"""
        async with self._lock:
            self.processing_active = False
    
    async def clear_old_frames(self, max_age_seconds: float = 30.0):
        """Remove frames older than max_age_seconds"""
        async with self._lock:
            current_time = time.time()
            # Keep only frames that are not too old
            self.queue = deque(
                [frame for frame in self.queue 
                 if current_time - frame.timestamp <= max_age_seconds],
                maxlen=self.queue.maxlen
            )


# Global queue manager instance
queue_manager = QueueManager(max_size=15, drop_threshold=5)