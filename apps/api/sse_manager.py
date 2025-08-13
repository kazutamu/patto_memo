import asyncio
import json
import uuid
from datetime import datetime
from typing import Dict, Optional

from fastapi import Request
from sse_starlette.sse import EventSourceResponse


class SSEConnectionManager:
    def __init__(self):
        self._connections: Dict[str, asyncio.Queue] = {}

    async def connect(self, request: Request) -> EventSourceResponse:
        """
        Establish a new SSE connection
        """
        client_id = str(uuid.uuid4())
        queue = asyncio.Queue()
        self._connections[client_id] = queue

        async def event_generator():
            try:
                # Send initial connection event
                yield {
                    "event": "connected",
                    "data": json.dumps({"client_id": client_id, "timestamp": datetime.now().isoformat()}),
                }

                # Keep connection alive and send events
                while True:
                    # Check if client disconnected
                    if await request.is_disconnected():
                        break

                    try:
                        # Wait for events with timeout for heartbeat
                        event = await asyncio.wait_for(queue.get(), timeout=30.0)
                        yield event
                    except asyncio.TimeoutError:
                        # Send heartbeat to keep connection alive
                        yield {
                            "event": "heartbeat",
                            "data": json.dumps({"timestamp": datetime.now().isoformat()}),
                        }

            finally:
                # Clean up on disconnect
                self.disconnect(client_id)

        return EventSourceResponse(event_generator())

    def disconnect(self, client_id: str):
        """
        Remove a client connection
        """
        if client_id in self._connections:
            del self._connections[client_id]

    async def broadcast(self, event_type: str, data: dict):
        """
        Broadcast an event to all connected clients
        """
        if not self._connections:
            return

        event = {"event": event_type, "data": json.dumps(data)}

        # Send to all connected clients
        disconnected_clients = []
        for client_id, queue in self._connections.items():
            try:
                # Non-blocking put with full queue handling
                queue.put_nowait(event)
            except asyncio.QueueFull:
                # Mark client for disconnection if queue is full
                disconnected_clients.append(client_id)

        # Clean up disconnected clients
        for client_id in disconnected_clients:
            self.disconnect(client_id)

    async def send_to_client(self, client_id: str, event_type: str, data: dict) -> bool:
        """
        Send an event to a specific client
        """
        if client_id not in self._connections:
            return False

        event = {"event": event_type, "data": json.dumps(data)}

        try:
            self._connections[client_id].put_nowait(event)
            return True
        except asyncio.QueueFull:
            self.disconnect(client_id)
            return False

    @property
    def connection_count(self) -> int:
        """
        Get the number of active connections
        """
        return len(self._connections)

    @property
    def connected_clients(self) -> list:
        """
        Get list of connected client IDs
        """
        return list(self._connections.keys())


# Global SSE manager instance
sse_manager = SSEConnectionManager()