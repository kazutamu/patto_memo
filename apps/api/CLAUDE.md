# API Backend - Development Guidelines

## Technology Stack

- Runtime: Python 3.9+
- Framework: FastAPI
- Database: MySQL with SQLAlchemy
- Data Validation: Pydantic for all API models and data schemas
- Authentication: JWT
- Video Processing: Lightweight frame processing utilities
- Scene Analysis: LLaVA via Ollama for batch processing
- ML Framework: Ollama API client for LLaVA integration
- Background Processing: Celery/RQ for async LLaVA analysis

## Environment Variables

- `DATABASE_URL` - MySQL connection string
- `JWT_SECRET` - JWT signing secret
- `PORT` - Server port (default: 8000)
- `ENVIRONMENT` - Environment (development/staging/production)
- `ALLOWED_ORIGINS` - CORS allowed origins
- `OLLAMA_API_URL` - Ollama server API endpoint (default: http://localhost:11434)
- `OLLAMA_MODEL` - LLaVA model name in Ollama (e.g., llava:7b, llava:13b)
- `OLLAMA_TIMEOUT` - API request timeout for LLaVA analysis

## Code Standards

### Python Backend Standards

- Use Pydantic models for all data validation and serialization
- Define clear request/response schemas for all API endpoints
- Use Pydantic BaseModel for configuration and settings
- Implement custom validators for domain-specific validation
- Use Pydantic's Field() for additional constraints and documentation

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

## LLaVA Integration via Ollama

### Background Processing Architecture

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

### Performance Optimization

- Background job queue for LLaVA analysis (non-blocking)
- Ollama API calls for LLaVA inference (offloaded processing)
- Intelligent batching of significant frames for AI efficiency
- Cache Ollama API results to reduce redundant analysis
- Optimize database queries with proper indexing
- Use Redis for job queuing and caching model results

## Backend Architecture

### Service Structure

```
src/
├── api/
│   ├── endpoints/
│   │   ├── motion.py
│   │   ├── auth.py
│   │   └── websocket.py
│   ├── dependencies/
│   │   ├── auth.py
│   │   └── database.py
│   └── middleware/
│       ├── cors.py
│       ├── rate_limit.py
│       └── logging.py
├── core/
│   ├── config.py
│   ├── security.py
│   └── database.py
├── models/
│   ├── motion.py
│   ├── user.py
│   └── base.py
├── schemas/
│   ├── motion.py
│   ├── user.py
│   └── websocket.py
├── services/
│   ├── motion_service.py
│   ├── llava_service.py
│   └── websocket_service.py
├── workers/
│   ├── llava_worker.py
│   └── background_tasks.py
└── utils/
    ├── ollama_client.py
    ├── frame_utils.py
    └── validators.py
```

### Pydantic Models

```python
# Motion Event Models
class MotionEvent(BaseModel):
    timestamp: datetime
    confidence: float = Field(ge=0.0, le=1.0)
    analysis: Optional[str] = None
    camera_id: str
    significance_score: float

class MotionConfig(BaseModel):
    sensitivity: float = Field(ge=0.1, le=1.0)
    significance_threshold: float = Field(ge=0.1, le=1.0)
    ai_analysis_enabled: bool = True

# Ollama Integration Models
class OllamaRequest(BaseModel):
    model: str
    prompt: str
    images: List[str]  # base64 encoded
    stream: bool = False

class OllamaResponse(BaseModel):
    response: str
    confidence: Optional[float] = None
    processing_time: float
```

## Background Processing

### Job Queue Architecture

- Redis-based job queues for LLaVA processing
- Priority queues for urgent motion events
- Dead letter queues for failed jobs
- Job retry mechanisms with exponential backoff
- Worker scaling based on queue depth

### Worker Management

```python
# LLaVA Processing Worker
class LLaVAWorker:
    def __init__(self, ollama_client: OllamaClient):
        self.ollama_client = ollama_client
        
    async def process_motion_event(self, event: MotionEvent) -> AIAnalysis:
        # Frame preprocessing and analysis
        # Ollama API integration
        # Result validation and storage
        pass
```

## Development Commands

- `npm run dev:api` - Start FastAPI development server
- `npm run build:api` - Build API application
- `npm run test:api` - Run backend tests (pytest)
- `npm run lint:api` - Run Python linting
- `npm run type-check:api` - Run mypy type checking
- `alembic upgrade head` - Apply database migrations
- `alembic revision --autogenerate -m "description"` - Create new migration

## Testing Strategy

- **Unit Tests**: API endpoints and business logic (pytest)
- **Integration Tests**: Database operations and Ollama integration
- **Load Tests**: Performance testing for motion event processing
- **Security Tests**: Authentication and data validation testing
- **Background Job Tests**: Queue processing and worker functionality