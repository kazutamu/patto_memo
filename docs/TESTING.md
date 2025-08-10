# Testing Strategy & Setup

This document outlines the comprehensive testing strategy for the Motion Detector monorepo project.

## Overview

The testing setup includes:
- **Backend Testing**: pytest + FastAPI TestClient with comprehensive coverage
- **CI/CD Pipeline**: GitHub Actions with automated quality gates and security scanning
- **Coverage Reporting**: Code coverage with 80% minimum requirement
- **Security Scanning**: Dependency vulnerability scanning and static analysis
- **Code Quality**: Automated linting, formatting, and type checking

## Quick Start

```bash
# Install all dependencies
npm run setup

# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run linting and formatting
npm run lint
npm run format

# Run security scans
npm run security:scan

# Full CI check (tests + linting + security + build)
npm run ci:check
```

## Frontend Testing (React/TypeScript)

### Technology Stack
- **Test Runner**: Vitest (fast, Vite-native)
- **Testing Library**: React Testing Library
- **Assertions**: Vitest built-in assertions
- **Coverage**: c8/v8 coverage provider
- **Mock Support**: Vitest mocking capabilities

### Test Files Structure
```
apps/web/src/test/
├── setup.ts          # Global test setup
├── App.test.tsx      # Main App component tests
├── api.test.ts       # API layer tests
└── types.test.ts     # TypeScript type validation tests
```

### Running Frontend Tests
```bash
# From root
npm run test:frontend

# From web app directory
cd apps/web
npm test              # Watch mode
npm run test:run      # Single run
npm run test:coverage # With coverage
```

### Frontend Test Coverage
- **App Component**: UI interactions, state management, error handling
- **API Layer**: HTTP requests, error handling, data validation
- **Type Safety**: TypeScript interface validation
- **Integration**: Component integration with API layer

### Key Frontend Test Patterns
```typescript
// Component testing with user interactions
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// API mocking
vi.mock('../api', () => ({
  api: {
    getMotionEvents: vi.fn(),
    createMotionEvent: vi.fn(),
    getMotionSettings: vi.fn()
  }
}))

// Async testing
await waitFor(() => {
  expect(screen.getByText('Expected Content')).toBeInTheDocument()
})
```

## Backend Testing (FastAPI/Python)

### Technology Stack
- **Test Runner**: pytest
- **HTTP Client**: httpx (via FastAPI TestClient)
- **Async Support**: pytest-asyncio
- **Coverage**: pytest-cov

### Test Files Structure
```
apps/api/tests/
├── __init__.py           # Test package initialization
├── conftest.py           # Shared fixtures and configuration
└── test_main.py          # API endpoint tests
```

### Running Backend Tests
```bash
# From root
npm run test:backend

# From API directory
cd apps/api
python -m pytest tests/ -v
python -m pytest tests/ --cov=. --cov-report=html  # With coverage
```

### Backend Test Coverage
- **Health Endpoints**: Basic connectivity and status checks
- **Motion Events API**: CRUD operations, data validation
- **Motion Settings API**: Configuration retrieval
- **Data Models**: Pydantic model validation
- **Error Handling**: HTTP error responses, validation errors
- **Performance**: Load testing for multiple requests

### Key Backend Test Patterns
```python
# Fixture-based testing
@pytest.fixture
def client():
    return TestClient(app)

# Endpoint testing
def test_get_motion_events(client):
    response = client.get("/api/v1/motion/events")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

# Data validation testing
def test_create_invalid_event(client):
    response = client.post("/api/v1/motion/events", json={"invalid": "data"})
    assert response.status_code == 422
```

## GitHub Actions CI/CD Pipeline

### Pipeline Structure
The CI/CD pipeline (`.github/workflows/ci.yml`) runs on every pull request and push to main with the following jobs:

1. **Backend Testing**: Comprehensive test suite across Python 3.9, 3.10, 3.11
2. **Security Scanning**: Multi-layered security analysis (Safety, Bandit, Semgrep)
3. **NPM Security**: Dependency vulnerability scanning for Node packages
4. **Docker Build**: Container build validation and testing
5. **Integration Testing**: End-to-end API validation with live services
6. **Code Quality**: Linting, formatting, and type checking (Black, isort, flake8)
7. **Build Validation**: Application startup and import validation
8. **CI Success**: Final status aggregation and quality gate enforcement

### Quality Gates
- ✅ **Backend Tests**: 302+ test cases across Python 3.9, 3.10, 3.11
- ✅ **Code Coverage**: 80% minimum requirement with detailed reporting
- ✅ **Security Scanning**: Safety (dependencies), Bandit (code), Semgrep (static analysis)
- ✅ **Code Quality**: Black formatting, isort imports, flake8 linting compliance
- ✅ **Docker Build**: Container builds and runs successfully
- ✅ **Integration Tests**: Live API endpoint validation
- ✅ **NPM Security**: No high/critical vulnerabilities in dependencies

### Pipeline Features
- **Parallel Execution**: Multiple jobs run simultaneously for faster feedback
- **Matrix Testing**: Backend tests across Python 3.9, 3.10, 3.11 versions
- **Security Multi-Layer**: Safety, Bandit, Semgrep, and npm audit scanning
- **Coverage Reporting**: Codecov integration with HTML artifact generation
- **Artifact Management**: Test results, coverage reports, security scan results
- **Docker Validation**: Container build testing with health checks
- **Quality Enforcement**: All checks must pass before merge approval

## Test Configuration Files

### Frontend Configuration
- `apps/web/vitest.config.ts`: Vitest configuration
- `apps/web/src/test/setup.ts`: Global test setup and mocks

### Backend Configuration  
- `apps/api/pytest.ini`: pytest configuration
- `apps/api/tests/conftest.py`: Shared fixtures

### CI/CD Configuration
- `.github/workflows/ci.yml`: GitHub Actions workflow

## Coverage Requirements

### Current Coverage Targets
- **Frontend**: Aim for 80%+ coverage on critical paths
- **Backend**: Aim for 90%+ coverage on API endpoints
- **Integration**: All API endpoints must have integration tests

### Coverage Reports
```bash
# Generate HTML coverage reports
npm run test:coverage

# View reports
open apps/web/coverage/index.html      # Frontend coverage
open apps/api/htmlcov/index.html       # Backend coverage
```

## Testing Best Practices

### Frontend Testing
1. **Test user interactions**, not implementation details
2. **Use semantic queries** (`getByRole`, `getByLabelText`)
3. **Mock external dependencies** (API calls, external services)
4. **Test error states** and loading states
5. **Use async/await** for asynchronous operations

### Backend Testing
1. **Test API contracts**, not internal implementation
2. **Use fixtures** for consistent test data
3. **Test edge cases** and validation errors
4. **Separate unit tests** from integration tests
5. **Test across Python versions** in CI

### Integration Testing
1. **Test complete user workflows**
2. **Use real HTTP requests** against running services
3. **Test API response formats** and status codes
4. **Verify data persistence** and state changes

## Debugging Tests

### Frontend Debugging
```bash
# Run specific test file
cd apps/web
npx vitest App.test.tsx

# Run with debug output
DEBUG=1 npm test

# Open browser for debugging
npx vitest --ui
```

### Backend Debugging
```bash
# Run specific test
cd apps/api
python -m pytest tests/test_main.py::TestHealthEndpoint::test_health_check -v

# Run with stdout
python -m pytest tests/ -v -s

# Run with debugger
python -m pytest tests/ --pdb
```

## Continuous Integration

### Local CI Simulation
```bash
# Run the full CI check locally
npm run ci:check

# This runs:
# - Type checking
# - All tests (frontend + backend) 
# - Build process
```

### CI Pipeline Triggers
- **Pull Requests**: All jobs run on PR creation/updates
- **Main Branch**: All jobs + deployment preparation
- **Manual**: Can be triggered manually via GitHub Actions UI

### CI Failure Handling
1. **Review test logs** in GitHub Actions output
2. **Run failing tests locally** to reproduce
3. **Fix issues** and push new commits
4. **Monitor coverage reports** for regressions

## Performance Considerations

### Frontend Tests
- **Parallel execution** via Vitest's built-in parallelization
- **Fast refresh** with Vite's hot module replacement
- **Selective testing** with file watching

### Backend Tests
- **Test isolation** via fixtures and database rollback
- **Parallel test execution** with pytest-xdist (future enhancement)
- **Mock external services** to avoid network dependencies

## Future Enhancements

### Short Term
- [ ] Add ESLint/Prettier configuration
- [ ] Add end-to-end tests with Playwright
- [ ] Implement visual regression testing

### Medium Term  
- [ ] Add performance testing benchmarks
- [ ] Implement mutation testing
- [ ] Add database integration tests
- [ ] Container-based testing environments

### Long Term
- [ ] Multi-environment testing (staging, production-like)
- [ ] Load testing and stress testing
- [ ] Automated deployment testing
- [ ] Cross-browser testing automation

## Troubleshooting

### Common Issues

#### Frontend Test Issues
```bash
# Module resolution errors
npm install
cd apps/web && npm install

# TypeScript errors in tests
npm run type-check:web

# Test timeouts
# Increase timeout in vitest.config.ts
```

#### Backend Test Issues
```bash
# Python environment issues
cd apps/api
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt

# Import errors
export PYTHONPATH=.  # or set PYTHONPATH=. on Windows
```

#### CI/CD Issues
- Check GitHub Actions logs for specific error messages
- Ensure all dependencies are properly specified
- Verify environment variables and secrets are configured
- Test Docker builds locally before pushing

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro)
- [pytest Documentation](https://docs.pytest.org/)
- [FastAPI Testing](https://fastapi.tiangolo.com/tutorial/testing/)
- [GitHub Actions](https://docs.github.com/en/actions)