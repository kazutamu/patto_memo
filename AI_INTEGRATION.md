# AI Integration - LLaVA Motion Analysis

## Overview

The Motion Detector now includes **real-time AI scene analysis** using LLaVA (Large Language and Vision Assistant) model. When significant motion is detected (>25% strength), frames are automatically analyzed to provide intelligent descriptions of what's happening.

## Features

### ✨ What's New

1. **Real-time AI Analysis**: Automatic scene description for motion events
2. **Smart Triggering**: Only analyzes significant motion (>25% strength)
3. **Background Processing**: Non-blocking AI analysis using Redis job queue
4. **Rate Limiting**: Maximum 10 AI analyses per minute to prevent overload
5. **Graceful Fallback**: Works without AI when services are unavailable

### 🎯 How It Works

1. **Motion Detection** → Browser detects motion locally
2. **Significance Check** → Only motion >25% strength triggers AI
3. **Frame Capture** → Compressed frame sent via WebSocket
4. **Background Queue** → Redis queues frame for processing
5. **LLaVA Analysis** → AI describes the scene
6. **Real-time Response** → Description appears as popup

## Quick Start

### Option 1: Automated Setup (Recommended)

```bash
# Run the all-in-one startup script
./start-with-ai.sh
```

This script will:
- Check and start Ollama with LLaVA model
- Start Redis for background processing
- Install Python dependencies
- Start both frontend and backend
- Display status and URLs

### Option 2: Docker Setup

```bash
# Start all services with Docker
docker-compose -f docker/docker-compose.yml up

# Services will be available at:
# - Frontend: https://localhost:3000
# - Backend: http://localhost:8000
# - Ollama: http://localhost:11434
```

### Option 3: Manual Setup

#### 1. Install and Start Ollama

```bash
# Install Ollama (macOS/Linux)
curl -fsSL https://ollama.ai/install.sh | sh

# Start Ollama service
ollama serve

# Pull LLaVA model (4GB download)
ollama pull llava:latest
```

#### 2. Start Redis

```bash
# Install Redis (macOS)
brew install redis
brew services start redis

# Or run with Docker
docker run -d -p 6379:6379 redis:alpine
```

#### 3. Start Backend API

```bash
cd apps/api
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

#### 4. Start Frontend

```bash
cd apps/web
npm install
npm run dev
```

## Testing the AI Features

1. **Open the app**: Navigate to https://localhost:3001
2. **Allow camera access**: Click "Turn On Camera"
3. **Trigger motion**: Move in front of camera
4. **See AI analysis**: Watch for popup with scene description

### What to Expect

- **Motion <25%**: No AI analysis (too minor)
- **Motion 25-50%**: AI analysis triggered, moderate confidence
- **Motion >50%**: High priority AI analysis, high confidence

### AI Response Examples

```
"A person wearing a blue shirt is walking from left to right"
"Multiple people detected having a conversation near the entrance"
"A delivery person approaching with a package"
"A cat is moving across the garden area"
```

## Configuration

### Environment Variables

```bash
# Backend (apps/api/.env)
OLLAMA_URL=http://localhost:11434
REDIS_URL=redis://localhost:6379/0
DATABASE_URL=mysql://root:password@localhost:3306/motion_detector

# Frontend (apps/web/.env)
VITE_WS_URL=ws://localhost:8000/ws
VITE_SIGNIFICANCE_THRESHOLD=25  # Minimum motion % for AI
VITE_AI_ANALYSIS_RATE=10        # Max AI requests per minute
```

## Architecture

### Component Flow

```
Browser → Motion Detection → WebSocket → Backend
                                ↓
                        Redis Queue (async)
                                ↓
                        AI Processor Worker
                                ↓
                        LLaVA (Ollama)
                                ↓
                        WebSocket Response → Browser Popup
```

### Key Components

- **Frontend**: `useAIAnalysis` hook, `AIAnalysisPopup` component
- **Backend**: WebSocket handler, AI processor worker
- **Infrastructure**: Ollama (LLaVA), Redis, MySQL

## Troubleshooting

### AI Status Shows "Disconnected"

- Check if backend is running: `http://localhost:8000/health`
- Verify WebSocket connection in browser console
- Ensure CORS is properly configured

### No AI Analysis Appearing

- Verify Ollama is running: `curl http://localhost:11434/api/tags`
- Check if LLaVA model is installed: `ollama list`
- Ensure Redis is running: `redis-cli ping`
- Check motion strength is >25%

### Slow AI Response

- LLaVA processing typically takes 2-5 seconds
- First analysis after startup may be slower
- Consider using GPU acceleration for Ollama

### Installation Issues

```bash
# Python dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Node dependencies
npm install

# Ollama model
ollama pull llava:latest  # Requires 4GB download
```

## Performance

- **Motion Detection**: <50ms latency (browser-side)
- **AI Analysis**: 2-5 seconds (LLaVA processing)
- **Rate Limiting**: Max 10 analyses/minute
- **Frame Compression**: 80-90% size reduction
- **Concurrent Users**: Handles multiple WebSocket connections

## System Requirements

- **RAM**: 8GB minimum, 16GB recommended
- **Storage**: 10GB (4GB for LLaVA model)
- **CPU**: 4+ cores recommended
- **GPU**: Optional but improves AI speed
- **Network**: Low latency for real-time updates

## API Endpoints

### WebSocket
- `ws://localhost:8000/ws` - Real-time motion events and AI results

### REST API
- `POST /api/v1/llava/analyze` - Direct LLaVA analysis
- `GET /api/v1/motion/events` - Motion event history
- `GET /health` - Service health check

## Development

### Running Tests

```bash
# Backend tests
cd apps/api
pytest tests/ -v

# Frontend tests
cd apps/web
npm test
```

### Adding Custom Prompts

Edit `apps/api/ai_processor.py`:

```python
prompt = (
    f"You are analyzing a security camera frame with {motion_strength:.1f}% motion detected. "
    "Your custom instructions here..."
)
```

## Security Considerations

- WebSocket connections are authenticated via unique IDs
- Rate limiting prevents AI abuse
- Frame data is not persisted by default
- HTTPS required for camera access on mobile

## Future Enhancements

- [ ] Object detection and tracking
- [ ] Multiple camera support
- [ ] Custom alert rules based on AI descriptions
- [ ] Historical analysis dashboard
- [ ] Model fine-tuning for specific scenarios