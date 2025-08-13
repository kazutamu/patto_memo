#!/usr/bin/env python3
"""
Simple test script to verify SSE implementation
Run the FastAPI server first: uvicorn main:app --reload
Then run this script: python test_sse.py
"""

import asyncio
import json
import threading
import time

import httpx


def listen_to_sse():
    """
    Connect to SSE endpoint and listen for events
    """
    print("Connecting to SSE endpoint...")
    
    with httpx.Client(timeout=None) as client:
        with client.stream("GET", "http://localhost:8000/api/v1/events/stream") as response:
            print(f"Connected! Status: {response.status_code}")
            
            for line in response.iter_lines():
                if line.startswith("event:"):
                    event_type = line.split(":", 1)[1].strip()
                    print(f"\n📡 Event Type: {event_type}")
                elif line.startswith("data:"):
                    data = line.split(":", 1)[1].strip()
                    try:
                        parsed_data = json.loads(data)
                        print(f"📦 Data: {json.dumps(parsed_data, indent=2)}")
                    except json.JSONDecodeError:
                        print(f"📦 Data: {data}")


async def trigger_events():
    """
    Trigger some events to test SSE broadcasting
    """
    await asyncio.sleep(2)  # Wait for SSE connection to establish
    
    async with httpx.AsyncClient() as client:
        print("\n🚀 Triggering motion event...")
        
        # Trigger a motion event
        motion_response = await client.post(
            "http://localhost:8000/api/v1/motion/events",
            json={
                "confidence": 0.95,
                "duration": 2.5,
                "description": "Test motion detected via SSE test script"
            }
        )
        
        if motion_response.status_code == 200:
            print("✅ Motion event created successfully")
        else:
            print(f"❌ Failed to create motion event: {motion_response.status_code}")
        
        await asyncio.sleep(2)
        
        # Check connection status
        connections_response = await client.get(
            "http://localhost:8000/api/v1/events/connections"
        )
        
        if connections_response.status_code == 200:
            connections = connections_response.json()
            print(f"\n📊 Active SSE connections: {connections['connection_count']}")
            print(f"🔗 Connected clients: {connections['connected_clients']}")


def main():
    print("=" * 50)
    print("SSE Implementation Test")
    print("=" * 50)
    
    # Start SSE listener in a separate thread
    sse_thread = threading.Thread(target=listen_to_sse, daemon=True)
    sse_thread.start()
    
    # Run event triggers
    asyncio.run(trigger_events())
    
    # Keep listening for a bit more
    print("\n⏰ Listening for 5 more seconds...")
    time.sleep(5)
    
    print("\n✨ Test completed!")


if __name__ == "__main__":
    main()