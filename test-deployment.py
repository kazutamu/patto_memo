#!/usr/bin/env python3
"""
Quick test script for Railway deployment
"""

import requests
import sys

def test_api(base_url):
    """Test the deployed API endpoints"""
    print(f"Testing API at: {base_url}")
    
    # Test health endpoint
    try:
        response = requests.get(f"{base_url}/health", timeout=10)
        if response.status_code == 200:
            print("✅ Health check passed")
            print(f"Response: {response.json()}")
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health check error: {e}")
        return False
    
    # Test prompts endpoint
    try:
        response = requests.get(f"{base_url}/api/v1/ai/prompts", timeout=10)
        if response.status_code == 200:
            print("✅ Prompts endpoint working")
        else:
            print(f"❌ Prompts endpoint failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Prompts endpoint error: {e}")
    
    # Test SSE endpoint (just connection, not streaming)
    try:
        response = requests.get(f"{base_url}/api/v1/events/connections", timeout=10)
        if response.status_code == 200:
            print("✅ SSE connections endpoint working")
            print(f"Active connections: {response.json()}")
        else:
            print(f"❌ SSE connections failed: {response.status_code}")
    except Exception as e:
        print(f"❌ SSE connections error: {e}")
    
    return True

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python test-deployment.py <base_url>")
        print("Example: python test-deployment.py https://your-app.railway.app")
        sys.exit(1)
    
    base_url = sys.argv[1].rstrip('/')
    test_api(base_url)