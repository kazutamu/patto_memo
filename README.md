# Motion Detector

A modern motion detection system with AI-powered scene analysis.

## Overview

This monorepo combines client-side motion detection with cloud-based AI analysis using LLaVA/Ollama for intelligent scene understanding and real-time alerts.

### Key Features

- **Real-time Motion Detection**: Browser-based motion detection with immediate alerts
- **AI Scene Analysis**: LLaVA integration for intelligent scene understanding
- **WebSocket Communication**: Real-time event streaming and notifications
- **Multi-platform**: Web application with planned mobile support

## Quick Start

### Prerequisites
- Node.js 16+ and npm 8+
- Python 3.9+ 
- Docker (optional)

### Installation

```bash
git clone <repository-url>
cd motion-detector
npm install
npm run setup
```

### Development

```bash
# Start all services
npm run dev

# Or start individually  
npm run dev:web    # Frontend → http://localhost:3000
npm run dev:api    # Backend → http://localhost:8000

# Using Docker
npm run dev:docker
```

## Architecture

### System Flow
1. **Motion Detection**: Client-side detection in browser/mobile
2. **Event Filtering**: Smart filtering to identify significant events
3. **AI Analysis**: Selected frames sent to LLaVA for scene analysis
4. **Real-time Alerts**: WebSocket delivery of motion events and AI insights

### Technology Stack
- **Frontend**: React + TypeScript + Vite
- **Backend**: FastAPI + Python + SQLAlchemy
- **AI**: LLaVA via Ollama for scene analysis
- **Database**: MySQL with Alembic migrations
- **Real-time**: WebSocket connections

## Project Structure

```
motion-detector/
├── apps/
│   ├── web/          # React frontend application
│   ├── api/          # FastAPI backend server
│   └── mobile/       # React Native mobile app (planned)
├── packages/         # Shared libraries and utilities
│   ├── shared/       # Common types and utilities
│   ├── ui/           # UI component library
│   └── config/       # Build and environment configs
└── docs/             # Documentation
```

## Available Commands

### Development
- `npm run dev` - Start all development servers
- `npm run dev:web` - Start React frontend only
- `npm run dev:api` - Start FastAPI backend only
- `npm run dev:docker` - Start with Docker Compose

### Build & Deploy
- `npm run build` - Build all applications
- `npm run test` - Run all tests
- `npm run type-check` - TypeScript type checking

### Maintenance
- `npm run clean` - Clean all node_modules and build artifacts
- `npm run stop` - Stop all running development servers

## Environment Setup

- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:8000  
- **API Docs**: http://localhost:8000/docs

## Documentation

For detailed development guidelines and architecture specifics:

- **[Main Guidelines](CLAUDE.md)** - Project overview and cross-cutting standards
- **[Frontend Guide](apps/web/CLAUDE.md)** - React app development
- **[Backend Guide](apps/api/CLAUDE.md)** - FastAPI server development
- **[Docker Guide](docker/CLAUDE.md)** - Deployment and containerization

## License

MIT