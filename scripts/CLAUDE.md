# Scripts - Development Guidelines

## Purpose

This directory contains build scripts, deployment automation, development utilities, and CI/CD pipeline scripts for the Motion Detector platform.

## Script Structure

```
scripts/
├── build/              # Build automation scripts
│   ├── build-all.sh    # Build all applications
│   ├── build-web.sh    # Build web application
│   ├── build-api.sh    # Build API server
│   └── build-mobile.sh # Build mobile application
├── deployment/         # Deployment scripts
│   ├── deploy-staging.sh
│   ├── deploy-production.sh
│   ├── rollback.sh
│   └── promote.sh
├── development/        # Development utilities
│   ├── setup-dev.sh    # Development environment setup
│   ├── reset-db.sh     # Database reset utility
│   ├── seed-data.sh    # Test data seeding
│   └── generate-env.sh # Environment file generation
├── testing/           # Testing automation
│   ├── run-tests.sh   # Test runner script
│   ├── e2e-setup.sh   # E2E test environment setup
│   └── load-test.sh   # Load testing script
├── maintenance/       # Maintenance scripts
│   ├── backup.sh      # Database backup
│   ├── cleanup.sh     # System cleanup
│   ├── update-deps.sh # Dependency updates
│   └── health-check.sh # System health check
├── ci/               # CI/CD scripts
│   ├── install-deps.sh
│   ├── run-linting.sh
│   ├── run-tests.sh
│   └── build-and-push.sh
└── CLAUDE.md         # This file
```

## Build Scripts

### Universal Build Script

```bash
#!/bin/bash
# scripts/build/build-all.sh

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BUILD_ENV=${1:-production}
SKIP_TESTS=${2:-false}
VERBOSE=${3:-false}

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Validate environment
validate_environment() {
    log_info "Validating build environment: ${BUILD_ENV}"
    
    if [[ ! "${BUILD_ENV}" =~ ^(development|staging|production)$ ]]; then
        log_error "Invalid environment: ${BUILD_ENV}. Must be development, staging, or production."
        exit 1
    fi
    
    # Check Node.js version
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi
    
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [[ ${NODE_VERSION} -lt 18 ]]; then
        log_error "Node.js version 18 or higher is required (found: ${NODE_VERSION})"
        exit 1
    fi
    
    # Check Python version
    if ! command -v python3 &> /dev/null; then
        log_error "Python 3 is not installed"
        exit 1
    fi
    
    log_info "Environment validation passed"
}

# Install dependencies
install_dependencies() {
    log_info "Installing dependencies..."
    
    # Root dependencies
    npm ci --prefer-offline --no-audit
    
    # Install Python dependencies for API
    if [[ -f "apps/api/requirements.txt" ]]; then
        log_info "Installing Python dependencies..."
        cd apps/api
        pip install -r requirements.txt
        cd ../..
    fi
    
    log_info "Dependencies installed successfully"
}

# Run linting
run_linting() {
    log_info "Running linting checks..."
    
    if ! npm run lint; then
        log_error "Linting checks failed"
        exit 1
    fi
    
    log_info "Linting checks passed"
}

# Run type checking
run_type_checking() {
    log_info "Running TypeScript type checking..."
    
    if ! npm run type-check; then
        log_error "Type checking failed"
        exit 1
    fi
    
    log_info "Type checking passed"
}

# Run tests
run_tests() {
    if [[ "${SKIP_TESTS}" == "true" ]]; then
        log_warn "Skipping tests as requested"
        return 0
    fi
    
    log_info "Running test suite..."
    
    # Unit tests
    if ! npm run test; then
        log_error "Unit tests failed"
        exit 1
    fi
    
    # Integration tests (if not in development)
    if [[ "${BUILD_ENV}" != "development" ]]; then
        if ! npm run test:integration; then
            log_error "Integration tests failed"
            exit 1
        fi
    fi
    
    log_info "All tests passed"
}

# Build applications
build_applications() {
    log_info "Building applications for ${BUILD_ENV} environment..."
    
    # Set environment variables
    export NODE_ENV=${BUILD_ENV}
    export VITE_BUILD_ENV=${BUILD_ENV}
    
    # Build shared packages first
    log_info "Building shared packages..."
    npm run build:shared
    npm run build:ui
    npm run build:config
    
    # Build web application
    log_info "Building web application..."
    if [[ "${VERBOSE}" == "true" ]]; then
        npm run build:web -- --mode ${BUILD_ENV}
    else
        npm run build:web -- --mode ${BUILD_ENV} 2>/dev/null
    fi
    
    # Build API (Python compilation/validation)
    log_info "Building API application..."
    cd apps/api
    python -m py_compile src/**/*.py
    cd ../..
    
    # Build mobile (if applicable)
    if [[ -d "apps/mobile" && -f "apps/mobile/package.json" ]]; then
        log_info "Building mobile application..."
        npm run build:mobile
    fi
    
    log_info "All applications built successfully"
}

# Generate build metadata
generate_metadata() {
    log_info "Generating build metadata..."
    
    BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    BUILD_VERSION=$(git describe --tags --always --dirty)
    BUILD_COMMIT=$(git rev-parse HEAD)
    BUILD_BRANCH=$(git rev-parse --abbrev-ref HEAD)
    
    cat > build-metadata.json <<EOF
{
  "buildTime": "${BUILD_TIME}",
  "buildVersion": "${BUILD_VERSION}",
  "buildCommit": "${BUILD_COMMIT}",
  "buildBranch": "${BUILD_BRANCH}",
  "buildEnvironment": "${BUILD_ENV}",
  "nodeVersion": "$(node --version)",
  "npmVersion": "$(npm --version)"
}
EOF
    
    log_info "Build metadata generated: build-metadata.json"
}

# Main build process
main() {
    log_info "Starting Motion Detector build process..."
    log_info "Environment: ${BUILD_ENV}"
    log_info "Skip Tests: ${SKIP_TESTS}"
    log_info "Verbose: ${VERBOSE}"
    
    validate_environment
    install_dependencies
    run_linting
    run_type_checking
    run_tests
    build_applications
    generate_metadata
    
    log_info "Build process completed successfully! 🎉"
    log_info "Build artifacts available in respective dist/ directories"
}

# Error handling
trap 'log_error "Build failed at line $LINENO"' ERR

# Run main function
main "$@"
```

### Web Application Build Script

```bash
#!/bin/bash
# scripts/build/build-web.sh

set -e

BUILD_ENV=${1:-production}
ANALYZE=${2:-false}

log_info "Building web application for ${BUILD_ENV}..."

# Set environment variables
export NODE_ENV=${BUILD_ENV}
export VITE_BUILD_ENV=${BUILD_ENV}

# Load environment-specific variables
if [[ -f "apps/web/.env.${BUILD_ENV}" ]]; then
    source "apps/web/.env.${BUILD_ENV}"
fi

cd apps/web

# Clean previous build
rm -rf dist/

# Build with Vite
if [[ "${ANALYZE}" == "true" ]]; then
    npm run build -- --mode ${BUILD_ENV} --analyze
else
    npm run build -- --mode ${BUILD_ENV}
fi

# Generate service worker (if needed)
if [[ "${BUILD_ENV}" == "production" ]]; then
    log_info "Generating service worker..."
    npm run generate:sw
fi

# Copy additional assets
cp -r public/static dist/ 2>/dev/null || true

log_info "Web application build completed"
log_info "Output: apps/web/dist/"

# Display build size information
if command -v du &> /dev/null; then
    BUILD_SIZE=$(du -sh dist/ | cut -f1)
    log_info "Build size: ${BUILD_SIZE}"
fi
```

## Deployment Scripts

### Staging Deployment Script

```bash
#!/bin/bash
# scripts/deployment/deploy-staging.sh

set -e

# Configuration
STAGING_HOST=${STAGING_HOST:-"staging.motion-detector.com"}
STAGING_USER=${STAGING_USER:-"deploy"}
DEPLOY_PATH=${DEPLOY_PATH:-"/opt/motion-detector"}
BACKUP_RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-7}

log_info() {
    echo -e "\033[0;32m[INFO]\033[0m $1"
}

log_error() {
    echo -e "\033[0;31m[ERROR]\033[0m $1"
}

# Pre-deployment validation
validate_deployment() {
    log_info "Validating deployment prerequisites..."
    
    # Check if staging host is reachable
    if ! ssh -o ConnectTimeout=10 ${STAGING_USER}@${STAGING_HOST} "echo 'Connection test passed'"; then
        log_error "Cannot connect to staging host: ${STAGING_HOST}"
        exit 1
    fi
    
    # Check if build artifacts exist
    if [[ ! -d "apps/web/dist" ]]; then
        log_error "Web build artifacts not found. Run build first."
        exit 1
    fi
    
    # Check Docker Compose files
    if [[ ! -f "docker/staging/docker-compose.yml" ]]; then
        log_error "Staging Docker Compose configuration not found"
        exit 1
    fi
    
    log_info "Deployment validation passed"
}

# Create deployment backup
create_backup() {
    log_info "Creating deployment backup..."
    
    BACKUP_NAME="motion-detector-staging-$(date +%Y%m%d-%H%M%S)"
    
    ssh ${STAGING_USER}@${STAGING_HOST} "
        cd ${DEPLOY_PATH}
        
        # Create backup directory
        mkdir -p backups
        
        # Backup current deployment
        if [[ -d current ]]; then
            tar -czf backups/${BACKUP_NAME}.tar.gz current/
            log_info 'Backup created: ${BACKUP_NAME}.tar.gz'
        fi
        
        # Clean old backups
        find backups/ -name '*.tar.gz' -mtime +${BACKUP_RETENTION_DAYS} -delete
    "
}

# Deploy application
deploy_application() {
    log_info "Deploying to staging environment..."
    
    # Create deployment archive
    tar -czf motion-detector-staging.tar.gz \
        --exclude='node_modules' \
        --exclude='.git' \
        --exclude='*.log' \
        .
    
    # Transfer to staging server
    scp motion-detector-staging.tar.gz ${STAGING_USER}@${STAGING_HOST}:${DEPLOY_PATH}/
    
    # Deploy on staging server
    ssh ${STAGING_USER}@${STAGING_HOST} "
        cd ${DEPLOY_PATH}
        
        # Stop current services
        if [[ -f docker-compose.yml ]]; then
            docker-compose down || true
        fi
        
        # Extract new deployment
        rm -rf next/
        mkdir -p next/
        tar -xzf motion-detector-staging.tar.gz -C next/
        
        # Switch to new deployment
        if [[ -d current ]]; then
            mv current previous
        fi
        mv next current
        
        # Update environment configuration
        cp ${DEPLOY_PATH}/staging.env current/.env
        
        # Start new services
        cd current
        docker-compose -f docker/staging/docker-compose.yml up -d
        
        # Clean up
        rm -f ${DEPLOY_PATH}/motion-detector-staging.tar.gz
    "
    
    # Clean up local archive
    rm -f motion-detector-staging.tar.gz
}

# Health check after deployment
post_deployment_check() {
    log_info "Performing post-deployment health checks..."
    
    # Wait for services to start
    sleep 30
    
    # Check application health
    MAX_RETRIES=10
    RETRY_COUNT=0
    
    while [[ ${RETRY_COUNT} -lt ${MAX_RETRIES} ]]; do
        if curl -f "https://${STAGING_HOST}/api/v1/health" > /dev/null 2>&1; then
            log_info "Application health check passed"
            break
        fi
        
        log_info "Waiting for application to be ready... (${RETRY_COUNT}/${MAX_RETRIES})"
        sleep 10
        ((RETRY_COUNT++))
    done
    
    if [[ ${RETRY_COUNT} -eq ${MAX_RETRIES} ]]; then
        log_error "Application health check failed"
        return 1
    fi
    
    # Run additional functional tests
    if [[ -f "scripts/testing/staging-smoke-test.sh" ]]; then
        log_info "Running staging smoke tests..."
        STAGING_URL="https://${STAGING_HOST}" ./scripts/testing/staging-smoke-test.sh
    fi
}

# Rollback on failure
rollback_deployment() {
    log_error "Deployment failed, initiating rollback..."
    
    ssh ${STAGING_USER}@${STAGING_HOST} "
        cd ${DEPLOY_PATH}
        
        # Stop failed deployment
        if [[ -d current ]]; then
            cd current
            docker-compose -f docker/staging/docker-compose.yml down || true
            cd ..
        fi
        
        # Restore previous deployment
        if [[ -d previous ]]; then
            rm -rf current
            mv previous current
            
            # Restart previous version
            cd current
            docker-compose -f docker/staging/docker-compose.yml up -d
            
            log_info 'Rollback completed'
        else
            log_error 'No previous deployment found for rollback'
        fi
    "
}

# Main deployment process
main() {
    log_info "Starting staging deployment..."
    
    if validate_deployment && create_backup && deploy_application; then
        if post_deployment_check; then
            log_info "Staging deployment completed successfully! 🚀"
            log_info "Application available at: https://${STAGING_HOST}"
        else
            rollback_deployment
            exit 1
        fi
    else
        log_error "Deployment failed"
        exit 1
    fi
}

# Error handling
trap 'rollback_deployment' ERR

main "$@"
```

## Development Utilities

### Development Environment Setup

```bash
#!/bin/bash
# scripts/development/setup-dev.sh

set -e

log_info() {
    echo -e "\033[0;32m[INFO]\033[0m $1"
}

log_error() {
    echo -e "\033[0;31m[ERROR]\033[0m $1"
}

# Check system requirements
check_requirements() {
    log_info "Checking system requirements..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is required but not installed"
        log_info "Please install Node.js 18+ from https://nodejs.org/"
        exit 1
    fi
    
    # Check Python
    if ! command -v python3 &> /dev/null; then
        log_error "Python 3 is required but not installed"
        exit 1
    fi
    
    # Check Docker (optional)
    if ! command -v docker &> /dev/null; then
        log_info "Docker not found (optional for development)"
    fi
    
    # Check Git
    if ! command -v git &> /dev/null; then
        log_error "Git is required but not installed"
        exit 1
    fi
    
    log_info "System requirements check passed"
}

# Setup Git hooks
setup_git_hooks() {
    log_info "Setting up Git hooks..."
    
    # Create hooks directory if it doesn't exist
    mkdir -p .git/hooks
    
    # Pre-commit hook
    cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
# Pre-commit hook: Run linting and tests

set -e

echo "Running pre-commit checks..."

# Run linting
npm run lint

# Run type checking
npm run type-check

# Run tests
npm run test

echo "Pre-commit checks passed"
EOF
    
    chmod +x .git/hooks/pre-commit
    
    # Pre-push hook
    cat > .git/hooks/pre-push << 'EOF'
#!/bin/bash
# Pre-push hook: Run full test suite

set -e

echo "Running pre-push checks..."

# Run full test suite
npm run test:full

echo "Pre-push checks passed"
EOF
    
    chmod +x .git/hooks/pre-push
    
    log_info "Git hooks configured"
}

# Generate environment files
generate_env_files() {
    log_info "Generating environment configuration files..."
    
    # Root .env file
    if [[ ! -f ".env" ]]; then
        cat > .env << 'EOF'
# Motion Detector Development Environment
NODE_ENV=development
DEBUG=true

# Database Configuration
DATABASE_URL=mysql://motion_user:motion_pass@localhost:3306/motion_detector_dev

# Redis Configuration
REDIS_URL=redis://localhost:6379

# JWT Configuration
JWT_SECRET=dev-super-secret-key-change-in-production

# Ollama Configuration
OLLAMA_API_URL=http://localhost:11434
OLLAMA_MODEL=llava:7b

# Development Ports
WEB_PORT=3000
API_PORT=8000
EOF
        log_info "Created .env file"
    fi
    
    # Web app environment
    if [[ ! -f "apps/web/.env.development" ]]; then
        cat > apps/web/.env.development << 'EOF'
# Web App Development Environment
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
VITE_MOTION_SENSITIVITY=0.5
VITE_DETECTION_INTERVAL=100
VITE_ENABLE_ANIMATIONS=true
VITE_THEME_MODE=dark
EOF
        log_info "Created web app development environment"
    fi
    
    # API environment
    if [[ ! -f "apps/api/.env.development" ]]; then
        cat > apps/api/.env.development << 'EOF'
# API Development Environment
DATABASE_URL=mysql://motion_user:motion_pass@localhost:3306/motion_detector_dev
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev-super-secret-key-change-in-production
OLLAMA_API_URL=http://localhost:11434
OLLAMA_MODEL=llava:7b
CORS_ORIGINS=http://localhost:3000
LOG_LEVEL=debug
EOF
        log_info "Created API development environment"
    fi
}

# Install development dependencies
install_dependencies() {
    log_info "Installing dependencies..."
    
    # Install Node.js dependencies
    npm install
    
    # Install Python dependencies
    if [[ -f "apps/api/requirements-dev.txt" ]]; then
        log_info "Installing Python development dependencies..."
        pip install -r apps/api/requirements-dev.txt
    fi
    
    # Install global development tools
    log_info "Installing global development tools..."
    npm install -g @playwright/test
    
    log_info "Dependencies installed"
}

# Setup database
setup_database() {
    log_info "Setting up development database..."
    
    # Check if MySQL is running
    if ! mysqladmin ping -h localhost --silent; then
        log_info "MySQL is not running. Please start MySQL service."
        log_info "On macOS: brew services start mysql"
        log_info "On Linux: sudo systemctl start mysql"
        return 1
    fi
    
    # Create database and user
    mysql -u root -p << 'EOF'
CREATE DATABASE IF NOT EXISTS motion_detector_dev;
CREATE USER IF NOT EXISTS 'motion_user'@'localhost' IDENTIFIED BY 'motion_pass';
GRANT ALL PRIVILEGES ON motion_detector_dev.* TO 'motion_user'@'localhost';
FLUSH PRIVILEGES;
EOF
    
    log_info "Database setup completed"
}

# Setup Ollama
setup_ollama() {
    log_info "Setting up Ollama for AI analysis..."
    
    if ! command -v ollama &> /dev/null; then
        log_info "Ollama not found. Installing..."
        curl -fsSL https://ollama.ai/install.sh | sh
    fi
    
    # Start Ollama service
    ollama serve &
    OLLAMA_PID=$!
    
    # Wait for Ollama to start
    sleep 5
    
    # Pull LLaVA model
    log_info "Pulling LLaVA model (this may take a while)..."
    ollama pull llava:7b
    
    # Stop background Ollama process
    kill $OLLAMA_PID 2>/dev/null || true
    
    log_info "Ollama setup completed"
}

# Run initial build
initial_build() {
    log_info "Running initial build..."
    
    # Build shared packages
    npm run build:shared
    npm run build:ui
    npm run build:config
    
    log_info "Initial build completed"
}

# Main setup process
main() {
    log_info "Setting up Motion Detector development environment..."
    
    check_requirements
    setup_git_hooks
    generate_env_files
    install_dependencies
    
    # Optional setups with user confirmation
    read -p "Setup development database? (y/N): " setup_db
    if [[ $setup_db =~ ^[Yy]$ ]]; then
        setup_database
    fi
    
    read -p "Setup Ollama for AI analysis? (y/N): " setup_ai
    if [[ $setup_ai =~ ^[Yy]$ ]]; then
        setup_ollama
    fi
    
    initial_build
    
    log_info "Development environment setup completed! 🎉"
    log_info ""
    log_info "Next steps:"
    log_info "1. Start development servers: npm run dev"
    log_info "2. Open web app: http://localhost:3000"
    log_info "3. Check API health: http://localhost:8000/api/v1/health"
    log_info ""
    log_info "For more information, check docs/development/setup.md"
}

main "$@"
```

### Database Reset Utility

```bash
#!/bin/bash
# scripts/development/reset-db.sh

set -e

ENVIRONMENT=${1:-development}
CONFIRM=${2:-false}

log_info() {
    echo -e "\033[0;32m[INFO]\033[0m $1"
}

log_warn() {
    echo -e "\033[1;33m[WARN]\033[0m $1"
}

log_error() {
    echo -e "\033[0;31m[ERROR]\033[0m $1"
}

# Safety check
safety_check() {
    if [[ "${ENVIRONMENT}" == "production" ]]; then
        log_error "Cannot reset production database!"
        exit 1
    fi
    
    if [[ "${CONFIRM}" != "true" ]]; then
        log_warn "This will completely reset the ${ENVIRONMENT} database!"
        log_warn "All data will be lost!"
        read -p "Are you sure? (y/N): " confirmation
        if [[ ! $confirmation =~ ^[Yy]$ ]]; then
            log_info "Database reset cancelled"
            exit 0
        fi
    fi
}

# Reset database
reset_database() {
    log_info "Resetting ${ENVIRONMENT} database..."
    
    # Load environment variables
    if [[ -f "apps/api/.env.${ENVIRONMENT}" ]]; then
        source "apps/api/.env.${ENVIRONMENT}"
    fi
    
    # Extract database connection details
    DB_URL=${DATABASE_URL}
    DB_NAME=$(echo $DB_URL | sed -n 's|.*://.*:.*/\([^?]*\).*|\1|p')
    DB_HOST=$(echo $DB_URL | sed -n 's|.*://.*@\([^:]*\):.*|\1|p')
    DB_USER=$(echo $DB_URL | sed -n 's|.*://\([^:]*\):.*|\1|p')
    DB_PASS=$(echo $DB_URL | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')
    
    # Drop and recreate database
    mysql -h ${DB_HOST} -u ${DB_USER} -p${DB_PASS} << EOF
DROP DATABASE IF EXISTS ${DB_NAME};
CREATE DATABASE ${DB_NAME};
EOF
    
    log_info "Database ${DB_NAME} reset successfully"
}

# Run migrations
run_migrations() {
    log_info "Running database migrations..."
    
    cd apps/api
    alembic upgrade head
    cd ../..
    
    log_info "Migrations completed"
}

# Seed test data
seed_test_data() {
    if [[ -f "scripts/development/seed-data.sh" ]]; then
        log_info "Seeding test data..."
        ./scripts/development/seed-data.sh ${ENVIRONMENT}
    fi
}

main() {
    safety_check
    reset_database
    run_migrations
    seed_test_data
    
    log_info "Database reset completed! ✨"
}

main "$@"
```

## Testing Scripts

### Comprehensive Test Runner

```bash
#!/bin/bash
# scripts/testing/run-tests.sh

set -e

TEST_TYPE=${1:-all}
ENVIRONMENT=${2:-test}
COVERAGE=${3:-true}
BAIL=${4:-false}

log_info() {
    echo -e "\033[0;32m[INFO]\033[0m $1"
}

log_error() {
    echo -e "\033[0;31m[ERROR]\033[0m $1"
}

# Setup test environment
setup_test_env() {
    log_info "Setting up test environment..."
    
    export NODE_ENV=test
    export CI=true
    
    # Start test services if needed
    if [[ -f "docker/testing/docker-compose.yml" ]]; then
        docker-compose -f docker/testing/docker-compose.yml up -d
        sleep 10
    fi
}

# Run unit tests
run_unit_tests() {
    log_info "Running unit tests..."
    
    local jest_args=""
    if [[ "${COVERAGE}" == "true" ]]; then
        jest_args="${jest_args} --coverage"
    fi
    if [[ "${BAIL}" == "true" ]]; then
        jest_args="${jest_args} --bail"
    fi
    
    npm run test:unit ${jest_args}
}

# Run integration tests
run_integration_tests() {
    log_info "Running integration tests..."
    
    # Ensure test database is ready
    npm run db:migrate:test
    
    npm run test:integration
}

# Run E2E tests
run_e2e_tests() {
    log_info "Running E2E tests..."
    
    # Start application in test mode
    npm run start:test &
    APP_PID=$!
    
    # Wait for app to be ready
    sleep 15
    
    # Run Playwright tests
    npx playwright test
    
    # Cleanup
    kill $APP_PID 2>/dev/null || true
}

# Run API tests
run_api_tests() {
    log_info "Running API tests..."
    
    cd apps/api
    pytest tests/ --cov=src/ --cov-report=xml --cov-report=term-missing
    cd ../..
}

# Run all tests
run_all_tests() {
    log_info "Running complete test suite..."
    
    run_unit_tests
    run_integration_tests
    run_api_tests
    
    if [[ "${ENVIRONMENT}" != "ci" ]]; then
        run_e2e_tests
    fi
}

# Cleanup
cleanup() {
    log_info "Cleaning up test environment..."
    
    # Stop test services
    if [[ -f "docker/testing/docker-compose.yml" ]]; then
        docker-compose -f docker/testing/docker-compose.yml down
    fi
}

# Main test execution
main() {
    log_info "Starting test execution: ${TEST_TYPE}"
    
    setup_test_env
    
    case ${TEST_TYPE} in
        unit)
            run_unit_tests
            ;;
        integration)
            run_integration_tests
            ;;
        e2e)
            run_e2e_tests
            ;;
        api)
            run_api_tests
            ;;
        all)
            run_all_tests
            ;;
        *)
            log_error "Unknown test type: ${TEST_TYPE}"
            log_info "Available types: unit, integration, e2e, api, all"
            exit 1
            ;;
    esac
    
    cleanup
    
    log_info "Test execution completed successfully! ✅"
}

# Error handling
trap cleanup ERR EXIT

main "$@"
```

## Maintenance Scripts

### System Cleanup Script

```bash
#!/bin/bash
# scripts/maintenance/cleanup.sh

set -e

DRY_RUN=${1:-false}
VERBOSE=${2:-false}

log_info() {
    echo -e "\033[0;32m[INFO]\033[0m $1"
}

log_warn() {
    echo -e "\033[1;33m[WARN]\033[0m $1"
}

# Docker cleanup
docker_cleanup() {
    log_info "Cleaning up Docker resources..."
    
    if [[ "${DRY_RUN}" == "true" ]]; then
        log_info "[DRY RUN] Would remove unused Docker images"
        docker images | grep "<none>" | wc -l | xargs -I {} echo "Would remove {} dangling images"
    else
        # Remove dangling images
        docker image prune -f
        
        # Remove unused containers
        docker container prune -f
        
        # Remove unused volumes
        docker volume prune -f
        
        # Remove unused networks
        docker network prune -f
    fi
}

# Node modules cleanup
node_cleanup() {
    log_info "Cleaning up Node.js modules..."
    
    find . -name "node_modules" -type d | while read -r dir; do
        if [[ "${DRY_RUN}" == "true" ]]; then
            log_info "[DRY RUN] Would remove: $dir"
        else
            log_info "Removing: $dir"
            rm -rf "$dir"
        fi
    done
    
    find . -name "package-lock.json" -type f | while read -r file; do
        if [[ "${DRY_RUN}" == "true" ]]; then
            log_info "[DRY RUN] Would remove: $file"
        else
            log_info "Removing: $file"
            rm -f "$file"
        fi
    done
}

# Build artifacts cleanup
build_cleanup() {
    log_info "Cleaning up build artifacts..."
    
    directories=("dist" "build" ".next" "coverage" ".nyc_output")
    
    for dir in "${directories[@]}"; do
        find . -name "$dir" -type d | while read -r found_dir; do
            if [[ "${DRY_RUN}" == "true" ]]; then
                log_info "[DRY RUN] Would remove: $found_dir"
            else
                log_info "Removing: $found_dir"
                rm -rf "$found_dir"
            fi
        done
    done
}

# Log cleanup
log_cleanup() {
    log_info "Cleaning up log files..."
    
    find . -name "*.log" -type f -mtime +7 | while read -r log_file; do
        if [[ "${DRY_RUN}" == "true" ]]; then
            log_info "[DRY RUN] Would remove: $log_file"
        else
            log_info "Removing: $log_file"
            rm -f "$log_file"
        fi
    done
}

# Cache cleanup
cache_cleanup() {
    log_info "Cleaning up cache directories..."
    
    # NPM cache
    if [[ "${DRY_RUN}" == "true" ]]; then
        log_info "[DRY RUN] Would clean npm cache"
    else
        npm cache clean --force
    fi
    
    # Python cache
    find . -name "__pycache__" -type d | while read -r cache_dir; do
        if [[ "${DRY_RUN}" == "true" ]]; then
            log_info "[DRY RUN] Would remove: $cache_dir"
        else
            log_info "Removing: $cache_dir"
            rm -rf "$cache_dir"
        fi
    done
    
    find . -name "*.pyc" -type f | while read -r pyc_file; do
        if [[ "${DRY_RUN}" == "true" ]]; then
            log_info "[DRY RUN] Would remove: $pyc_file"
        else
            rm -f "$pyc_file"
        fi
    done
}

# Main cleanup process
main() {
    if [[ "${DRY_RUN}" == "true" ]]; then
        log_warn "DRY RUN MODE - No files will be actually deleted"
    fi
    
    log_info "Starting system cleanup..."
    
    docker_cleanup
    node_cleanup
    build_cleanup
    log_cleanup
    cache_cleanup
    
    log_info "System cleanup completed! 🧹"
}

main "$@"
```

## Script Usage

### Common Commands

```bash
# Build all applications
./scripts/build/build-all.sh production

# Setup development environment
./scripts/development/setup-dev.sh

# Deploy to staging
./scripts/deployment/deploy-staging.sh

# Run all tests
./scripts/testing/run-tests.sh all

# Reset development database
./scripts/development/reset-db.sh development

# System cleanup
./scripts/maintenance/cleanup.sh

# Health check
./scripts/maintenance/health-check.sh
```

### Script Permissions

```bash
# Make all scripts executable
find scripts/ -name "*.sh" -exec chmod +x {} \;

# Or individually
chmod +x scripts/build/build-all.sh
chmod +x scripts/deployment/deploy-staging.sh
chmod +x scripts/development/setup-dev.sh
```

## Integration with NPM Scripts

### Package.json Script Integration

```json
{
  "scripts": {
    "setup:dev": "./scripts/development/setup-dev.sh",
    "build:all": "./scripts/build/build-all.sh",
    "deploy:staging": "./scripts/deployment/deploy-staging.sh",
    "deploy:production": "./scripts/deployment/deploy-production.sh",
    "test:all": "./scripts/testing/run-tests.sh all",
    "db:reset": "./scripts/development/reset-db.sh development",
    "cleanup": "./scripts/maintenance/cleanup.sh",
    "health:check": "./scripts/maintenance/health-check.sh"
  }
}
```