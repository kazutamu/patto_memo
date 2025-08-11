# Agent Delegation System

## Area-Based Agent Routing

When working in specific code areas, automatically delegate to specialized agents:

### Backend Areas → python-backend-engineer
- `apps/api/` - FastAPI backend, Pydantic models, database operations
- `apps/api/src/models/` - Database models and schemas
- `apps/api/src/routes/` - API endpoints and routing
- `apps/api/src/services/` - Business logic and external integrations
- `apps/api/tests/` - Backend testing
- `requirements.txt`, `pyproject.toml` - Python dependencies
- `alembic/` - Database migrations

### Frontend Areas → react-frontend-engineer  
- `apps/web/` - React web application
- `apps/web/src/components/` - React components
- `apps/web/src/hooks/` - Custom React hooks
- `apps/web/src/utils/` - Frontend utilities
- `apps/web/src/styles/` - CSS and styling
- `package.json` (web), `vite.config.ts` - Frontend build config
- `apps/web/tests/` - Frontend testing

### Mobile Areas → react-frontend-engineer
- `apps/mobile/` - React Native mobile app
- `apps/mobile/src/` - Mobile components and screens
- `apps/mobile/android/`, `apps/mobile/ios/` - Native platform code

### Infrastructure Areas → devops-infrastructure-engineer
- `docker/` - Docker configurations and deployment
- `scripts/` - Build and deployment scripts  
- `.github/workflows/` - CI/CD pipelines
- `kubernetes/` - Kubernetes manifests
- `docker-compose.yml` - Container orchestration
- Environment files (`.env.*`)

### Architecture & System Design → architecture-consultant
- Cross-cutting architectural decisions
- System performance issues
- Technology stack evaluation
- Database design and optimization
- API design patterns
- Microservices vs monolith decisions

### Product & Strategy → product-architect
- Feature planning and prioritization
- Requirements gathering and breakdown
- Technical debt vs feature development decisions
- User experience and business logic
- Integration planning
- Product roadmap tasks

## Auto-Delegation Rules

### Triggers for Automatic Agent Selection

1. **File Path Analysis**: When user mentions specific paths or works in certain directories
2. **Task Keywords**: Specific terms that indicate domain expertise needed
3. **Cross-Cutting Concerns**: When tasks span multiple areas

### Agent Selection Logic

```
IF working_in(apps/api/) OR mentions("FastAPI", "Pydantic", "database", "SQL", "Python")
  → USE python-backend-engineer

ELSE IF working_in(apps/web/) OR mentions("React", "components", "frontend", "UI", "CSS") 
  → USE react-frontend-engineer

ELSE IF working_in(docker/, scripts/, .github/) OR mentions("deployment", "CI/CD", "containers")
  → USE devops-infrastructure-engineer

ELSE IF mentions("architecture", "system design", "performance", "scalability")
  → USE architecture-consultant

ELSE IF mentions("feature", "requirements", "product", "user story", "prioritize")
  → USE product-architect

ELSE 
  → USE general-purpose agent
```

## Task Delegation Workflow

### Product-Driven Development

1. **Product Architect** receives high-level requirements
2. **Product Architect** breaks down features into technical tasks
3. **Product Architect** delegates each task to appropriate specialist agent:
   - Backend API work → python-backend-engineer
   - Frontend components → react-frontend-engineer  
   - Deployment/infrastructure → devops-infrastructure-engineer
   - Architectural decisions → architecture-consultant

### Example Delegation Flow

```
User: "I want to add real-time notifications to show motion detection alerts"

1. Product Architect analyzes:
   - Frontend: notification UI components, real-time updates
   - Backend: WebSocket endpoints, notification logic
   - Infrastructure: message queuing, scaling considerations

2. Product Architect creates tasks:
   - "Design notification UI components" → react-frontend-engineer
   - "Implement WebSocket notification endpoints" → python-backend-engineer
   - "Set up Redis for message queuing" → devops-infrastructure-engineer
   - "Review notification architecture for scale" → architecture-consultant

3. Each specialist agent handles their domain tasks
```

## Implementation Guidelines

### For Product Architect
- Always break down features into domain-specific tasks
- Consider all affected systems (frontend, backend, infrastructure)
- Include testing and deployment considerations
- Provide clear requirements for each delegated task

### For Specialist Agents
- Focus on domain expertise and best practices
- Coordinate with other agents when tasks have dependencies
- Provide detailed technical implementation
- Include testing and quality assurance

### For Cross-Cutting Tasks
- Use architecture-consultant for system-wide decisions
- Use general-purpose for simple tasks spanning multiple domains
- Use product-architect when business logic needs clarification