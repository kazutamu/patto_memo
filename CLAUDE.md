# Motion Detector - Development Guidelines

## Project Structure

This project follows a monorepo structure with the following organization:

```
motion-detector/
├── apps/                     # Application packages
│   ├── web/                  # Frontend web application
│   ├── mobile/               # Mobile application (future)
│   └── api/                  # Backend API server
├── packages/                 # Shared packages/libraries
│   ├── shared/               # Shared utilities, types, constants
│   ├── ui/                   # Shared UI components
│   └── config/               # Shared configurations
├── docs/                     # Documentation
├── scripts/                  # Build/deployment scripts
├── docker/                   # Docker configurations
└── .github/                  # GitHub workflows
```

## Development Commands

### Setup
- `npm install` - Install all dependencies
- `npm run setup` - Initial project setup

### Development
- `npm run dev` - Start all development servers
- `npm run dev:web` - Start React web app
- `npm run dev:api` - Start FastAPI server

### Build & Test
- `npm run build` - Build all applications
- `npm run test` - Run all tests
- `npm run lint` - Run linting
- `npm run type-check` - Run TypeScript type checking

### Deployment
- `npm run deploy:staging` - Deploy to staging
- `npm run deploy:prod` - Deploy to production

## Code Standards

### General
- Use TypeScript for all code
- Follow ESLint and Prettier configurations
- Write tests for all new features
- Use conventional commits

### Python Backend Standards
- Use Pydantic models for all data validation and serialization
- Define clear request/response schemas for all API endpoints
- Use Pydantic BaseModel for configuration and settings
- Implement custom validators for domain-specific validation
- Use Pydantic's Field() for additional constraints and documentation

### Naming Conventions
- Files: kebab-case (`motion-detector.ts`)
- Components: PascalCase (`MotionDetector.tsx`)
- CSS Modules: kebab-case (`motion-detector.module.css`)
- Variables/Functions: camelCase (`detectMotion`)
- CSS Classes: kebab-case (`motion-container`, `alert-badge`)
- Constants: UPPER_SNAKE_CASE (`MAX_DETECTION_THRESHOLD`)

### Import Organization
1. External libraries
2. Internal packages (`@motion-detector/shared`)
3. Relative imports

## Technology Stack

### Frontend (apps/web)
- Framework: React with TypeScript
- Styling: CSS Modules with modern design system
- State Management: Zustand for simple state management
- Build Tool: Vite
- Motion Detection: Browser-based OpenCV.js or MediaPipe
- Video Processing: WebRTC for camera access and frame analysis
- UI Design: Dark theme with glass morphism and smooth animations

### Backend (apps/api)
- Runtime: Python 3.9+
- Framework: FastAPI
- Database: MySQL with SQLAlchemy
- Data Validation: Pydantic for all API models and data schemas
- Authentication: JWT
- Video Processing: Lightweight frame processing utilities
- Scene Analysis: LLaVA via Ollama for batch processing
- ML Framework: Ollama API client for LLaVA integration
- Background Processing: Celery/RQ for async LLaVA analysis

### Mobile (apps/mobile) - Future
- Framework: React Native with TypeScript
- Navigation: React Navigation

### Shared (packages/)
- Monorepo: npm workspaces
- Package Manager: npm
- Testing: Jest + Testing Library (Frontend), pytest (Backend)

## Environment Variables

### Web App
- `VITE_API_URL` - API base URL
- `VITE_WS_URL` - WebSocket URL for real-time updates
- `VITE_MOTION_SENSITIVITY` - Default motion detection sensitivity (0.1-1.0)
- `VITE_DETECTION_INTERVAL` - Frame analysis interval (ms)
- `VITE_SIGNIFICANCE_THRESHOLD` - Threshold for triggering AI analysis (0.1-1.0)
- `VITE_AI_ANALYSIS_RATE` - Max AI analysis requests per minute
- `VITE_FRAME_COMPRESSION_QUALITY` - WebP compression quality (0.1-1.0)
- `VITE_ENABLE_WEBWORKERS` - Enable WebWorkers for heavy processing
- `VITE_ENABLE_ANIMATIONS` - Enable UI animations and effects
- `VITE_THEME_MODE` - UI theme (dark/light, default: dark)

### API Server
- `DATABASE_URL` - MySQL connection string
- `JWT_SECRET` - JWT signing secret
- `PORT` - Server port (default: 8000)
- `ENVIRONMENT` - Environment (development/staging/production)
- `ALLOWED_ORIGINS` - CORS allowed origins
- `OLLAMA_API_URL` - Ollama server API endpoint (default: http://localhost:11434)
- `OLLAMA_MODEL` - LLaVA model name in Ollama (e.g., llava:7b, llava:13b)
- `OLLAMA_TIMEOUT` - API request timeout for LLaVA analysis

## Database

### Schema Management
- Use Alembic for database migrations
- Run `alembic revision --autogenerate -m "description"` for new migrations
- Run `alembic upgrade head` to apply migrations

### Conventions
- Table names: snake_case plural (`motion_events`)
- Column names: snake_case (`created_at`)
- Foreign keys: `{table}_id` (`user_id`)

## API Design

### REST Endpoints
- Use RESTful conventions
- Prefix with `/api/v1/`
- Use proper HTTP status codes
- Pydantic models for all request/response validation
- Auto-generated OpenAPI schema from Pydantic models
- Type-safe JSON serialization/deserialization

### Real-time Features
- Use WebSocket for live motion detection updates
- Implement FastAPI WebSocket endpoints
- Pydantic models for WebSocket message validation
- Type-safe WebSocket event serialization
- Handle connection management and reconnection logic

## Security

### Authentication
- Use JWT tokens with proper expiration
- Implement refresh token rotation
- Secure password hashing with bcrypt

### Data Protection
- Pydantic validation for all inputs (automatic)
- Use parameterized queries with SQLAlchemy
- Implement rate limiting
- Set proper CORS policies
- Field-level validation and sanitization with Pydantic
- Custom validators for motion detection data

## Motion Detection Specific

### Core Features
- Client-side motion detection using webcam and mobile cameras
- Browser-based real-time motion analysis (OpenCV.js/MediaPipe)
- Event-driven architecture (motion events sent to backend)
- LLaVA-powered intelligent scene analysis (server-side batch processing)
- Natural language event descriptions and summaries
- Configurable detection sensitivity and thresholds (client-side)
- Event recording with AI-generated detailed analysis
- Two-tier alert system: immediate client alerts + server AI analysis
- Cross-platform browser and mobile support
- Modern, stylish user interface with dark theme and animations

### Performance
- Client-side motion detection eliminates server processing load
- Significance filtering reduces AI analysis to ~5-10% of motion events
- Efficient browser-based frame processing (WebWorkers for heavy operations)
- Compressed frame transmission (WebP/JPEG) reduces bandwidth by 80-90%
- Event-driven backend processing (only significant motion events)
- Background job queue for LLaVA analysis (non-blocking)
- Ollama API calls for LLaVA inference (offloaded processing)
- Intelligent batching of significant frames for AI efficiency
- Cache Ollama API results to reduce redundant analysis
- Optimize database queries with proper indexing
- Use Redis for job queuing and caching model results

### Camera Integration
- WebRTC for browser-based webcam access
- Mobile camera API integration
- Real-time frame streaming via WebSocket
- Support for multiple simultaneous camera feeds

### LLaVA Integration via Ollama
- Background processing architecture with job queues
- Ollama server setup and model management
- HTTP API client for LLaVA inference requests
- Pydantic models for Ollama request/response validation
- Efficient prompt engineering for scene analysis
- Frame preprocessing and base64 encoding for API
- Result parsing and confidence scoring with Pydantic
- Fallback mechanisms for Ollama server failures
- Connection pooling and timeout handling
- Processing priority queue (recent events first)

### Deployment
- Docker containerization for application services
- Separate Ollama server container with LLaVA model
- Cloud platform deployment on standard instances
- Ollama model management and version control
- Environment-specific configurations
- CI/CD pipeline integration with Ollama health checks

## User Experience Design

### MVP Interface Design
- **Single Screen Application**: Full-screen video feed with minimal controls
- **Ultra-Simple Controls**: Motion toggle (ON/OFF) and sensitivity slider only
- **No Complex Features**: No user accounts, history logs, or settings pages for MVP
- **Focus**: Perfect the core experience of motion detection → alert → AI insight

### Visual Design System
- **Theme**: Dark mode with neon accent colors (cyan/purple)
- **Typography**: Modern font (Inter or Poppins) with varied weights
- **Layout**: Glass morphism effects with rounded corners and subtle shadows
- **Animations**: Smooth transitions, slide-in popups, and satisfying interactions

### Interactive Elements
- **Video Display**: Full-screen camera feed with subtle glow effect when motion detected
- **Motion Toggle**: Smooth animated toggle with satisfying click feedback
- **Sensitivity Slider**: Color-coded gradient slider (green → yellow → red)
- **Alert Popups**: Modern card-based notifications with smooth animations
- **AI Analysis**: Typing animation for text reveal with confidence percentage bars

### User Flow
1. **Main Interface**: Live video feed with motion toggle and sensitivity slider
2. **Motion Detection**: Instant popup alert with timestamp and dismiss button
3. **AI Analysis**: Delayed stylish card showing LLaVA insights with confidence score
4. **Visual Feedback**: Pulsing glow around video during motion events

### Responsive Design
- **Desktop**: Full-screen immersive experience
- **Mobile**: Touch-optimized controls with haptic feedback simulation
- **Tablet**: Adaptive layout maintaining visual hierarchy

### Architecture Flow
1. **Client Layer:** Browser/mobile detects motion → immediate local alert
2. **Filtering Layer:** Client determines if motion is significant enough for AI analysis
3. **Frame Transmission:** Only significant motion frames sent to backend (compressed)
4. **Processing Layer:** Backend queues significant frames for Ollama analysis
5. **Intelligence Layer:** Ollama processes frames via API → generates descriptions
6. **Notification Layer:** Enhanced alerts with AI insights sent back to client

### Frame Streaming Architecture
- **Motion Detection:** Client-side only (no data transmission)
- **Significance Filtering:** Client determines high-confidence motion events
- **Frame Transmission:** Compressed frames (WebP/JPEG) via WebSocket for significant events only
- **Selective Processing:** Only ~5-10% of motion events trigger AI analysis
- **Bandwidth Optimization:** Typical usage ~50KB per significant event vs ~500KB per frame

## System Architecture

### Service Topology
- API Gateway (Nginx/Traefik) for request routing and SSL termination
- Load Balancer for horizontal scaling of API instances
- Message Broker (Redis) with dead letter queues for background jobs
- In-memory frame processing (no persistent storage)
- Service health monitoring and discovery

### Communication Patterns
- Synchronous: REST APIs for motion event submission and user management
- Asynchronous: Redis queues for LLaVA background processing
- Real-time: WebSocket connections for sending motion events and receiving AI insights
- Event-driven: Client-side motion detection + server-side event processing

## Scalability Architecture

### Horizontal Scaling Strategy
- API Layer: Stateless FastAPI containers behind load balancer
- Worker Layer: Auto-scaling LLaVA processing workers
- Database Layer: MySQL with read replicas and connection pooling
- Cache Layer: Redis for job queues and session management

### Resource Management
- LLaVA Worker Pools: Separate CPU-intensive worker containers
- Memory Management: Frame buffering with automatic cleanup
- Database Connection Pools: Connection limits and timeout handling
- Queue Management: Partition queues by camera/priority

## Data Architecture

### Data Flow Patterns
- Client Streaming: Live camera feeds → client-side motion detection → events
- Event Processing: Motion events (with frame data) sent to backend → stored as metadata
- No File Storage: Frames processed in-memory (client + server) and discarded
- Queue Management: Background job processing with Redis for AI analysis

### Storage Strategy
- Transactional Data: MySQL for motion events metadata
- Session Data: Redis for WebSocket connections and job queues
- No Binary Storage: Frames exist only during processing
- Time-series Events: Motion event logs with timestamps

## Observability Architecture

### Monitoring Stack
- Metrics: Prometheus + Grafana for system metrics
- Logging: Structured logging with log aggregation
- Health Checks: FastAPI health endpoints for all services
- Alerting: Critical system alerts and notifications

### Key Metrics
- Motion Detection: Detection frequency, processing latency
- LLaVA Processing: Queue depth, processing time, success rates
- System Health: CPU/memory usage, response times, error rates
- WebSocket: Active connections, message throughput

## Reliability Architecture

### Fault Tolerance Patterns
- Circuit Breakers: Protect against LLaVA model failures
- Retry Policies: Exponential backoff for transient failures
- Graceful Degradation: Motion detection continues without AI analysis
- Queue Management: Dead letter queues for failed LLaVA jobs

### Recovery Mechanisms
- Health Checks: Container liveness and readiness probes
- Auto-restart: Failed workers automatically restarted
- Memory Management: Automatic cleanup of stale frames
- Connection Recovery: WebSocket reconnection handling

## Infrastructure Architecture

### Container Orchestration
- Docker containers for all services
- Environment-specific configurations
- Auto-scaling based on CPU and queue metrics
- No persistent volumes needed (stateless processing)

### Security Architecture
- JWT authentication with proper token management
- Rate limiting per user/IP
- CORS policies for web app integration
- Input validation and sanitization
- No sensitive data storage (frames discarded after processing)