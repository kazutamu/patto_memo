#!/bin/bash

# Start script for Motion Detector with AI integration
# This script starts all necessary services for the complete stack

echo "🚀 Starting Motion Detector with AI Integration"
echo "================================================"

# Check if Ollama is installed locally
if command -v ollama &> /dev/null; then
    echo "✅ Ollama found locally"
    
    # Start Ollama service if not running
    if ! pgrep -x "ollama" > /dev/null; then
        echo "Starting Ollama service..."
        ollama serve &
        sleep 3
    fi
    
    # Check if LLaVA model is available
    if ! ollama list | grep -q "llava"; then
        echo "📥 Downloading LLaVA model (this may take a few minutes)..."
        ollama pull llava:latest
    else
        echo "✅ LLaVA model already available"
    fi
else
    echo "⚠️  Ollama not found locally. You can either:"
    echo "   1. Install Ollama: https://ollama.ai/download"
    echo "   2. Use Docker: docker-compose -f docker/docker-compose.yml up"
fi

# Check if Redis is running
if command -v redis-cli &> /dev/null; then
    if redis-cli ping &> /dev/null; then
        echo "✅ Redis is running"
    else
        echo "⚠️  Redis is not running. Starting Redis..."
        if command -v redis-server &> /dev/null; then
            redis-server --daemonize yes
            echo "✅ Redis started"
        else
            echo "❌ Redis not installed. Please install Redis or use Docker"
        fi
    fi
else
    echo "⚠️  Redis not found. Please install Redis or use Docker"
fi

# Install Python dependencies if needed
echo ""
echo "📦 Checking Python dependencies..."
cd apps/api
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate 2>/dev/null || . venv/Scripts/activate 2>/dev/null || {
    echo "❌ Failed to activate virtual environment"
    exit 1
}

pip install -q -r requirements.txt
echo "✅ Python dependencies installed"

# Start the backend API
echo ""
echo "🔧 Starting FastAPI backend..."
uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Wait for backend to start
sleep 3

# Start the frontend
echo ""
echo "🎨 Starting React frontend..."
cd ../../apps/web
npm run dev &
FRONTEND_PID=$!

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down services..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Display status
echo ""
echo "================================================"
echo "✨ Motion Detector with AI is running!"
echo ""
echo "📱 Frontend: https://localhost:3001"
echo "🔧 Backend API: http://localhost:8000"
echo "📚 API Docs: http://localhost:8000/docs"
echo ""
echo "AI Features:"
echo "  • Real-time motion detection"
echo "  • LLaVA scene analysis for significant motion"
echo "  • WebSocket live updates"
echo "  • Background AI processing"
echo ""
echo "Press Ctrl+C to stop all services"
echo "================================================"

# Keep script running
wait