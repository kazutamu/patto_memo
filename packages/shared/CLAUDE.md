# Shared Package - Development Guidelines

## Purpose

This package contains shared utilities, types, constants, and business logic used across all applications in the monorepo. It serves as the single source of truth for common functionality.

## Package Structure

```
packages/shared/
├── src/
│   ├── types/           # TypeScript interfaces and types
│   │   ├── motion.ts    # Motion detection types
│   │   ├── websocket.ts # WebSocket event types
│   │   ├── api.ts       # API request/response types
│   │   └── index.ts     # Type exports
│   ├── constants/       # Application constants
│   │   ├── motion.ts    # Motion detection constants
│   │   ├── api.ts       # API endpoints and configurations
│   │   ├── ui.ts        # UI constants and themes
│   │   └── index.ts     # Constant exports
│   ├── utils/           # Shared utility functions
│   │   ├── motion.ts    # Motion analysis utilities
│   │   ├── validation.ts # Common validation functions
│   │   ├── formatting.ts # Data formatting utilities
│   │   ├── storage.ts   # Storage utilities
│   │   └── index.ts     # Utility exports
│   ├── schemas/         # Validation schemas
│   │   ├── motion.ts    # Motion event schemas
│   │   ├── user.ts      # User-related schemas
│   │   └── index.ts     # Schema exports
│   └── index.ts         # Main package exports
├── package.json
├── tsconfig.json
└── CLAUDE.md           # This file
```

## Core Types

### Key Interfaces
- **MotionEvent** - Motion detection events with confidence and significance scores
- **AIAnalysis** - LLaVA analysis results with descriptions and categories  
- **MotionConfig** - Sensitivity, thresholds, and detection settings
- **WebSocketMessage** - Real-time communication events
- **APIResponse** - Standard API response format with error handling

See `src/types/` for complete interface definitions.

## Constants

### Motion Detection
- **Sensitivity Range**: 0.1 - 1.0 (default: 0.5)
- **Significance Threshold**: 0.7 for AI analysis
- **Detection Interval**: 100ms frame processing
- **Frame Compression**: 0.8 quality for bandwidth efficiency

### API Endpoints
- **Motion Events**: `/api/v1/motion/events`
- **Configuration**: `/api/v1/motion/config` 
- **WebSocket**: `/ws/motion` for real-time updates

## Shared Utilities

### Core Functions
- **motionUtils** - Significance calculation, event validation, frame compression
- **validationUtils** - Input validation for sensitivity, timestamps, camera IDs  
- **formatUtils** - Timestamp, confidence percentage, duration formatting
- **WebSocket helpers** - Event serialization and message handling

See `src/utils/` for complete implementations.

## Usage

```typescript
import {
  MotionEvent,
  AIAnalysis,
  motionUtils,
  MOTION_CONSTANTS,
} from '@motion-detector/shared';

// Runtime validation with Zod schemas available in src/schemas/
// Type-safe imports and utilities throughout the application
```

## Development Guidelines

- **Types**: Add to `src/types/` with JSDoc documentation
- **Utilities**: Pure functions in `src/utils/` with comprehensive tests
- **Constants**: Group related constants in `src/constants/`
- **Schemas**: Validation schemas in `src/schemas/` for runtime checking
- **Exports**: All public APIs exported from main index file