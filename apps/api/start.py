#!/usr/bin/env python3
"""
Startup script for Render deployment
"""
import os
import subprocess
import sys

def main():
    """Start the FastAPI application"""
    port = os.getenv("PORT", "8000")
    
    # Use uvicorn to start the FastAPI app
    cmd = [
        "uvicorn", 
        "main:app", 
        "--host", "0.0.0.0", 
        "--port", port,
        "--workers", "1"
    ]
    
    print(f"Starting FastAPI server on port {port}")
    print(f"Command: {' '.join(cmd)}")
    
    # Execute uvicorn
    subprocess.run(cmd)

if __name__ == "__main__":
    main()