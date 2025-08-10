# Motion Detector - Development Guidelines

## Overview

This is the main development guidelines file for the Motion Detector project. For detailed guidelines specific to each part of the system, see the distributed CLAUDE.md files in each directory.

## Project Structure & Documentation

This project follows a monorepo structure with distributed documentation:

```
motion-detector/
├── apps/                     # Application packages
│   ├── web/                  # Frontend web application → See apps/web/CLAUDE.md
│   ├── mobile/               # Mobile application → See apps/mobile/CLAUDE.md
│   └── api/                  # Backend API server → See apps/api/CLAUDE.md
├── packages/                 # Shared packages/libraries
│   ├── shared/               # Shared utilities, types
│   ├── ui/                   # UI components
│   └── config/               # Configurations
├── docs/                     # Documentation
├── scripts/                  # Build/deployment scripts → See scripts/CLAUDE.md
├── docker/                   # Docker configurations → See docker/CLAUDE.md
└── .github/                  # GitHub workflows
```

## Quick Reference

### Application-Specific Guidelines

- **[Web Frontend](apps/web/CLAUDE.md)** - React, Vite, motion detection, UI/UX design
- **[API Backend](apps/api/CLAUDE.md)** - FastAPI, Pydantic, LLaVA integration, WebSocket
- **[Mobile App](apps/mobile/CLAUDE.md)** - React Native, native modules, mobile optimization

### Infrastructure & Operations

- **[Docker & Deployment](docker/CLAUDE.md)** - Containerization, deployment strategies
- **[Scripts & Automation](scripts/CLAUDE.md)** - Build scripts, deployment, maintenance

### Shared Packages

- **Shared Utilities** (`packages/shared/`) - Common types, constants, utilities, validation
- **UI Components** (`packages/ui/`) - Design system, components, animations  
- **Configuration** (`packages/config/`) - Build configs, environments, tooling

## Core Development Commands

### Quick Start

- `npm install` - Install all dependencies
- `npm run setup` - Initial project setup (see [scripts/CLAUDE.md](scripts/CLAUDE.md))
- `npm run dev` - Start all development servers

### Development Workflow

- `npm run dev:web` - Start React web app (details: [apps/web/CLAUDE.md](apps/web/CLAUDE.md))
- `npm run dev:api` - Start FastAPI server (details: [apps/api/CLAUDE.md](apps/api/CLAUDE.md))
- `npm run build` - Build all applications (details: [scripts/CLAUDE.md](scripts/CLAUDE.md))
- `npm run test` - Run all tests (details: [scripts/CLAUDE.md](scripts/CLAUDE.md))

### Quality Assurance

- `npm run lint` - Run linting (config in `packages/config/`)
- `npm run type-check` - Run TypeScript type checking
- `npm run test:e2e` - Run end-to-end tests

### Deployment

- `npm run deploy:staging` - Deploy to staging (details: [docker/CLAUDE.md](docker/CLAUDE.md))
- `npm run deploy:prod` - Deploy to production (details: [docker/CLAUDE.md](docker/CLAUDE.md))

## Cross-Cutting Standards

### Code Quality Standards
- **TypeScript**: Strict mode enabled across all applications
- **Testing**: 80% minimum coverage requirement  
- **Linting**: ESLint + Prettier configurations (in `packages/config/`)
- **Commits**: Conventional commit format

### Naming Conventions (Project-Wide)
- **Files**: kebab-case (`motion-detector.ts`)
- **Components**: PascalCase (`MotionDetector.tsx`) 
- **Variables/Functions**: camelCase (`detectMotion`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_DETECTION_THRESHOLD`)

### Architecture Patterns
- **Frontend**: Component-driven development (see [apps/web/CLAUDE.md](apps/web/CLAUDE.md))
- **Backend**: Pydantic models for all data validation (see [apps/api/CLAUDE.md](apps/api/CLAUDE.md))
- **Shared**: Type-safe utilities and constants (in `packages/shared/`)

## Technology Stack Overview

### Frontend Stack
- **Framework**: React with TypeScript
- **Build**: Vite with modern tooling
- **Styling**: CSS Modules with dark theme design system
- **Motion Detection**: Browser-based OpenCV.js/MediaPipe
- **Details**: See [apps/web/CLAUDE.md](apps/web/CLAUDE.md)

### Backend Stack  
- **Framework**: FastAPI with Python 3.9+
- **Database**: MySQL with SQLAlchemy
- **AI Integration**: LLaVA via Ollama for scene analysis
- **Validation**: Pydantic models for all data schemas
- **Details**: See [apps/api/CLAUDE.md](apps/api/CLAUDE.md)

### Mobile Stack (Future)
- **Framework**: React Native with TypeScript
- **Details**: See [apps/mobile/CLAUDE.md](apps/mobile/CLAUDE.md)

### Infrastructure
- **Monorepo**: npm workspaces
- **Containerization**: Docker with multi-stage builds
- **Deployment**: Kubernetes & Docker Compose
- **Details**: See [docker/CLAUDE.md](docker/CLAUDE.md)

## Environment Configuration

Environment variables and configuration are managed per application and package:

- **Web App Environment**: See [apps/web/CLAUDE.md](apps/web/CLAUDE.md) for `VITE_*` variables
- **API Server Environment**: See [apps/api/CLAUDE.md](apps/api/CLAUDE.md) for database, JWT, Ollama config
- **Configuration Management**: Build configs and environment handling in `packages/config/`

## System Architecture Summary

### Motion Detection Flow
1. **Client-Side Detection**: Browser/mobile detects motion → immediate local alert
2. **Significance Filtering**: Client determines high-confidence events for AI analysis  
3. **Frame Transmission**: Only significant frames sent to backend (compressed)
4. **AI Processing**: LLaVA via Ollama analyzes frames → generates descriptions
5. **Enhanced Alerts**: AI insights sent back to client via WebSocket

### Database & API Design
- **Database Management**: Alembic migrations, snake_case conventions
- **API Standards**: RESTful `/api/v1/` endpoints with Pydantic validation
- **Real-time**: WebSocket for motion events and AI analysis results
- **Details**: See [apps/api/CLAUDE.md](apps/api/CLAUDE.md)

### Security & Performance
- **Authentication**: JWT with refresh tokens, bcrypt password hashing
- **Performance**: Client-side filtering reduces AI analysis to ~5-10% of events
- **Bandwidth**: WebP compression reduces transmission by 80-90%
- **Details**: See [apps/api/CLAUDE.md](apps/api/CLAUDE.md) and [docker/CLAUDE.md](docker/CLAUDE.md)

## Cross-Cutting Standards

### Code Quality
- **TypeScript**: Strict mode everywhere, no `any` types in production
- **Testing**: 80% minimum coverage across all applications
- **Commits**: Conventional format with Claude Code attribution
- **Reviews**: All changes require peer review before merge

### Git Workflow
- **Branch Strategy**: Feature branches from main, no direct commits
- **Pull Requests**: Automated quality gates must pass
- **Quality Standards**: Pre-commit hooks, CI/CD pipeline, coverage requirements

## Key Principles

### Architecture Principles
- **Client-Side Processing**: Motion detection happens in browser/mobile
- **Selective AI Analysis**: Only significant events (~5-10%) sent for AI processing  
- **Event-Driven**: Real-time WebSocket communication for alerts and AI insights
- **Scalable Design**: Stateless services, horizontal scaling, efficient resource usage

### Development Principles
- **Type Safety**: TypeScript + Pydantic validation throughout
- **Component Reusability**: Shared UI components and utilities
- **Clean Architecture**: Clear separation of concerns, dependency injection
- **Performance First**: Client-side filtering, compression, efficient processing

## Getting Started

1. **Read This Overview**: Understand the distributed documentation structure
2. **Choose Your Focus**: Navigate to specific CLAUDE.md files for detailed guidance
3. **Setup Environment**: Use [scripts/CLAUDE.md](scripts/CLAUDE.md) for development setup
4. **Follow Standards**: Apply the cross-cutting standards throughout development

For implementation details, architecture specifics, and operational procedures, refer to the distributed CLAUDE.md files in each directory.
