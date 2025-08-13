#!/usr/bin/env python3
"""
Test SSE broadcasting for AI analysis
"""

import asyncio
import base64
import json
import threading

import httpx


def listen_to_sse():
    """
    Connect to SSE endpoint and listen for AI analysis events
    """
    print("🎧 Listening for SSE events...")
    
    with httpx.Client(timeout=None) as client:
        with client.stream("GET", "http://localhost:8000/api/v1/events/stream") as response:
            for line in response.iter_lines():
                if line.startswith("event:"):
                    event_type = line.split(":", 1)[1].strip()
                    if event_type == "ai_analysis":
                        print(f"\n🤖 AI Analysis Event Received!")
                elif line.startswith("data:") and "ai_analysis" in str(line):
                    data = line.split(":", 1)[1].strip()
                    try:
                        parsed_data = json.loads(data)
                        print(f"📊 Analysis Result: {json.dumps(parsed_data, indent=2)}")
                    except json.JSONDecodeError:
                        pass


async def trigger_ai_analysis():
    """
    Trigger AI analysis with a dummy image
    """
    await asyncio.sleep(1)  # Wait for SSE connection
    
    # Create a small dummy image (1x1 pixel white PNG)
    dummy_png_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
    
    async with httpx.AsyncClient() as client:
        print("\n🚀 Triggering AI analysis (this will broadcast to SSE)...")
        
        response = await client.post(
            "http://localhost:8000/api/v1/llava/analyze",
            json={
                "image_base64": dummy_png_base64,
                "prompt": "Test analysis for SSE broadcasting"
            },
            timeout=10.0
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ AI Analysis completed: {result.get('success')}")
            if not result.get('success'):
                print(f"⚠️  Error: {result.get('error_message')}")
        else:
            print(f"❌ Request failed: {response.status_code}")


def main():
    print("=" * 50)
    print("SSE AI Analysis Broadcasting Test")
    print("=" * 50)
    
    # Start SSE listener in background
    sse_thread = threading.Thread(target=listen_to_sse, daemon=True)
    sse_thread.start()
    
    # Trigger AI analysis
    asyncio.run(trigger_ai_analysis())
    
    # Keep listening briefly
    print("\n⏰ Waiting for SSE broadcast...")
    asyncio.run(asyncio.sleep(2))
    
    print("\n✨ Test completed!")


if __name__ == "__main__":
    main()