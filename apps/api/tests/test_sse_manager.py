"""
Tests for SSE (Server-Sent Events) connection manager functionality.
"""

import asyncio
import json
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import Request

from sse_manager import SSEConnectionManager, sse_manager


class TestSSEConnectionManager:
    """Test SSE connection manager functionality."""

    @pytest.fixture
    def manager(self):
        """Create a fresh SSE manager for each test."""
        return SSEConnectionManager()

    @pytest.fixture
    def mock_request(self):
        """Create a mock FastAPI request object."""
        request = MagicMock(spec=Request)
        request.is_disconnected = AsyncMock(return_value=False)
        return request

    @pytest.fixture
    def mock_disconnected_request(self):
        """Create a mock request that simulates disconnection."""
        request = MagicMock(spec=Request)
        request.is_disconnected = AsyncMock(return_value=True)
        return request

    def test_manager_initialization(self, manager):
        """Test that SSE manager initializes correctly."""
        assert manager.connection_count == 0
        assert manager.connected_clients == []

    @pytest.mark.asyncio
    async def test_broadcast_with_no_connections(self, manager):
        """Test broadcasting when no clients are connected."""
        # Should not raise an error
        await manager.broadcast("test_event", {"message": "test"})
        assert manager.connection_count == 0

    def test_disconnect_nonexistent_client(self, manager):
        """Test disconnecting a client that doesn't exist."""
        # Should not raise an error
        manager.disconnect("nonexistent_client_id")
        assert manager.connection_count == 0

    @pytest.mark.asyncio
    async def test_send_to_nonexistent_client(self, manager):
        """Test sending to a client that doesn't exist."""
        result = await manager.send_to_client(
            "nonexistent_id", "test_event", {"data": "test"}
        )
        assert result is False

    def test_connection_properties(self, manager):
        """Test connection count and client list properties."""
        # Initially empty
        assert manager.connection_count == 0
        assert manager.connected_clients == []

        # Manually add a connection for testing
        manager._connections["test_client"] = asyncio.Queue()

        assert manager.connection_count == 1
        assert manager.connected_clients == ["test_client"]

        # Clean up
        manager.disconnect("test_client")
        assert manager.connection_count == 0

    @pytest.mark.asyncio
    async def test_broadcast_to_single_client(self, manager):
        """Test broadcasting to a single connected client."""
        # Add a client manually
        queue = asyncio.Queue()
        manager._connections["test_client"] = queue

        # Broadcast an event
        test_data = {"message": "hello", "timestamp": "2023-01-01T00:00:00"}
        await manager.broadcast("test_event", test_data)

        # Check that the event was queued
        assert not queue.empty()
        event = queue.get_nowait()

        assert event["event"] == "test_event"
        assert json.loads(event["data"]) == test_data

    @pytest.mark.asyncio
    async def test_send_to_specific_client(self, manager):
        """Test sending event to a specific client."""
        # Add two clients
        queue1 = asyncio.Queue()
        queue2 = asyncio.Queue()
        manager._connections["client1"] = queue1
        manager._connections["client2"] = queue2

        # Send to specific client
        test_data = {"message": "private message"}
        result = await manager.send_to_client("client1", "private_event", test_data)

        assert result is True
        assert not queue1.empty()
        assert queue2.empty()

        # Check the message content
        event = queue1.get_nowait()
        assert event["event"] == "private_event"
        assert json.loads(event["data"]) == test_data

    @pytest.mark.asyncio
    async def test_broadcast_to_multiple_clients(self, manager):
        """Test broadcasting to multiple connected clients."""
        # Add multiple clients
        queues = {}
        for i in range(3):
            client_id = f"client_{i}"
            queues[client_id] = asyncio.Queue()
            manager._connections[client_id] = queues[client_id]

        # Broadcast to all
        test_data = {"message": "broadcast to all"}
        await manager.broadcast("broadcast_event", test_data)

        # Check all clients received the message
        for client_id, queue in queues.items():
            assert not queue.empty()
            event = queue.get_nowait()
            assert event["event"] == "broadcast_event"
            assert json.loads(event["data"]) == test_data

    @pytest.mark.asyncio
    async def test_broadcast_with_full_queue_cleanup(self, manager):
        """Test that clients with full queues are disconnected."""
        # Create a queue and fill it beyond capacity
        queue = asyncio.Queue(maxsize=1)
        queue.put_nowait("dummy")  # Fill the queue

        manager._connections["full_queue_client"] = queue
        assert manager.connection_count == 1

        # Try to broadcast - should disconnect the client due to full queue
        await manager.broadcast("test_event", {"data": "test"})

        assert manager.connection_count == 0
        assert "full_queue_client" not in manager.connected_clients

    @pytest.mark.asyncio
    async def test_send_to_client_with_full_queue(self, manager):
        """Test sending to client with full queue results in disconnection."""
        # Create a full queue
        queue = asyncio.Queue(maxsize=1)
        queue.put_nowait("dummy")

        manager._connections["full_queue_client"] = queue

        # Try to send - should fail and disconnect client
        result = await manager.send_to_client(
            "full_queue_client", "test_event", {"data": "test"}
        )

        assert result is False
        assert manager.connection_count == 0

    def test_disconnect_existing_client(self, manager):
        """Test disconnecting an existing client."""
        # Add a client
        manager._connections["test_client"] = asyncio.Queue()
        assert manager.connection_count == 1

        # Disconnect
        manager.disconnect("test_client")
        assert manager.connection_count == 0
        assert "test_client" not in manager.connected_clients

    @pytest.mark.asyncio
    async def test_event_data_serialization(self, manager):
        """Test that event data is properly JSON serialized."""
        queue = asyncio.Queue()
        manager._connections["test_client"] = queue

        # Test with complex data structure
        complex_data = {
            "string": "hello",
            "number": 42,
            "boolean": True,
            "null": None,
            "array": [1, 2, 3],
            "nested": {"key": "value"},
        }

        await manager.broadcast("complex_event", complex_data)

        event = queue.get_nowait()
        assert event["event"] == "complex_event"

        # Data should be JSON string
        assert isinstance(event["data"], str)

        # Should be parseable back to original data
        parsed_data = json.loads(event["data"])
        assert parsed_data == complex_data


class TestGlobalSSEManager:
    """Test the global SSE manager instance."""

    def test_global_manager_exists(self):
        """Test that global sse_manager instance exists."""
        assert sse_manager is not None
        assert isinstance(sse_manager, SSEConnectionManager)

    def test_global_manager_initial_state(self):
        """Test global manager starts with no connections."""
        # Note: This might not be 0 if other tests have run
        assert isinstance(sse_manager.connection_count, int)
        assert isinstance(sse_manager.connected_clients, list)


class TestSSEConnectionIntegration:
    """Integration tests for SSE connection handling."""

    @pytest.mark.asyncio
    async def test_connection_lifecycle(self):
        """Test complete connection lifecycle with realistic scenario."""
        manager = SSEConnectionManager()

        # Simulate connecting multiple clients
        client_queues = {}
        for i in range(3):
            client_id = f"user_{i}"
            queue = asyncio.Queue()
            manager._connections[client_id] = queue
            client_queues[client_id] = queue

        assert manager.connection_count == 3

        # Broadcast initial message
        await manager.broadcast("user_joined", {"user_id": "new_user"})

        # All clients should receive the message
        for queue in client_queues.values():
            event = queue.get_nowait()
            assert event["event"] == "user_joined"

        # Send private message to one user
        await manager.send_to_client(
            "user_0", "private_message", {"content": "Hello user_0!"}
        )

        # Only user_0 should have the private message
        private_event = client_queues["user_0"].get_nowait()
        assert private_event["event"] == "private_message"

        # Other users should have no additional messages
        assert client_queues["user_1"].empty()
        assert client_queues["user_2"].empty()

        # Disconnect one client
        manager.disconnect("user_1")
        assert manager.connection_count == 2
        assert "user_1" not in manager.connected_clients

        # Broadcast final message
        await manager.broadcast("final_message", {"content": "goodbye"})

        # Only remaining clients should receive it
        for client_id in ["user_0", "user_2"]:
            event = client_queues[client_id].get_nowait()
            assert event["event"] == "final_message"


class TestSSEConnectionFlow:
    """Test the actual SSE connection flow including event generators."""

    @pytest.mark.asyncio
    async def test_connection_event_generator_immediate_disconnect(self):
        """Test event generator when client disconnects immediately."""
        manager = SSEConnectionManager()

        # Mock a request that is immediately disconnected
        request = MagicMock(spec=Request)
        request.is_disconnected = AsyncMock(return_value=True)

        # Get the EventSourceResponse
        response = await manager.connect(request)

        # The response should be an EventSourceResponse
        from sse_starlette.sse import EventSourceResponse

        assert isinstance(response, EventSourceResponse)

    @pytest.mark.asyncio
    async def test_connection_event_generator_with_timeout(self):
        """Test event generator with timeout (heartbeat)."""
        manager = SSEConnectionManager()

        # Mock a request that stays connected initially
        request = MagicMock(spec=Request)
        disconnect_calls = 0

        async def mock_is_disconnected():
            nonlocal disconnect_calls
            disconnect_calls += 1
            # Disconnect after a few calls to simulate client leaving
            return disconnect_calls > 2

        request.is_disconnected = mock_is_disconnected

        # Get the EventSourceResponse and iterate a few events
        response = await manager.connect(request)

        # Extract the generator from the response
        generator = response.body_iterator

        events_received = []
        try:
            # Get first event (connection event)
            first_event = await generator.__anext__()
            events_received.append(first_event)

            # The first event should be a connection event
            assert first_event["event"] == "connected"
            assert "client_id" in first_event["data"]

        except StopAsyncIteration:
            pass

        # Should have received at least the connection event
        assert len(events_received) >= 1

    @pytest.mark.asyncio
    async def test_event_generator_heartbeat(self):
        """Test that heartbeat events are generated."""
        import asyncio
        from unittest.mock import patch

        manager = SSEConnectionManager()

        # Mock request that stays connected
        request = MagicMock(spec=Request)
        request.is_disconnected = AsyncMock(return_value=False)

        # Mock asyncio.wait_for to simulate timeout quickly
        original_wait_for = asyncio.wait_for

        async def mock_wait_for(coro, timeout):
            if timeout == 30.0:  # Our heartbeat timeout
                raise asyncio.TimeoutError()
            return await original_wait_for(coro, timeout)

        with patch("asyncio.wait_for", side_effect=mock_wait_for):
            response = await manager.connect(request)
            generator = response.body_iterator

            try:
                # Get connection event
                first_event = await generator.__anext__()
                assert first_event["event"] == "connected"

                # Get heartbeat event (should happen due to our timeout mock)
                second_event = await generator.__anext__()
                assert second_event["event"] == "heartbeat"

            except StopAsyncIteration:
                pass
