# Docker & Deployment - Development Guidelines

## Purpose

This directory contains Docker configurations, deployment scripts, and infrastructure-as-code for the Motion Detector platform across different environments.

## Directory Structure

```
docker/
├── development/         # Development environment
│   ├── docker-compose.yml
│   ├── docker-compose.override.yml
│   └── .env.example
├── production/          # Production environment
│   ├── docker-compose.yml
│   ├── docker-compose.prod.yml
│   └── .env.prod.example
├── services/           # Individual service configurations
│   ├── web/
│   │   ├── Dockerfile
│   │   └── nginx.conf
│   ├── api/
│   │   ├── Dockerfile
│   │   └── requirements.txt
│   ├── ollama/
│   │   ├── Dockerfile
│   │   └── setup.sh
│   └── nginx/
│       ├── Dockerfile
│       └── default.conf
├── kubernetes/         # Kubernetes manifests
│   ├── namespace.yaml
│   ├── configmap.yaml
│   ├── secrets.yaml
│   ├── deployments/
│   ├── services/
│   └── ingress/
├── scripts/           # Deployment scripts
│   ├── deploy.sh
│   ├── health-check.sh
│   └── backup.sh
└── CLAUDE.md         # This file
```

## Docker Services

### Service Architecture
- **Web App**: Multi-stage build with Nginx serving static files
- **API Server**: Python FastAPI with non-root user security  
- **Ollama**: LLaVA model server with automated model pulls
- **Database**: MySQL with persistent volumes
- **Redis**: Cache and job queue with data persistence
- **Nginx**: Load balancer with SSL termination

All Dockerfiles use multi-stage builds with health checks and security best practices.

## Development Environment

### Docker Compose Development
- **Hot Reload**: Volume mounts for live code changes
- **Port Mapping**: All services accessible on localhost
- **Environment Variables**: Development-specific configuration
- **Service Dependencies**: Automatic startup order and health checks
- **Database Initialization**: Auto-creates schemas and test data

Configuration files in `development/` directory with override support.

## Production Environment

### Production Features
- **Load Balancing**: Nginx with multiple API/web replicas
- **SSL Termination**: HTTPS with certificate management
- **Resource Limits**: CPU and memory constraints for each service
- **Auto-restart**: Services automatically restart on failure
- **Persistent Storage**: Data volumes for database and AI models
- **Environment Variables**: Externalized secrets and configuration

Configurations in `production/` directory with scaling and security settings.

## Kubernetes Deployment

### Features
- **Namespace Isolation**: Dedicated namespace with resource quotas
- **ConfigMaps**: Environment-specific configuration management
- **Secrets**: Secure handling of sensitive data (JWT, database credentials)
- **Health Checks**: Liveness and readiness probes for all services
- **Auto-scaling**: Horizontal pod autoscaling based on CPU/memory
- **Resource Limits**: CPU and memory constraints per service

Manifests available in `kubernetes/` directory.

## Deployment Automation

### Scripts & Tools
- **deploy.sh**: Automated deployment with environment validation and health checks
- **health-check.sh**: Comprehensive service health validation
- **backup.sh**: Database backup with cloud storage integration  
- **Environment Validation**: Pre-deployment checks for required variables

### Security & Performance
- **Security Hardening**: Non-root users, read-only filesystems, security contexts
- **Resource Management**: Memory and CPU limits for production workloads
- **Backup & Recovery**: Automated database backups with retention policies

## Development Commands

- `npm run docker:dev` - Start development environment
- `npm run docker:prod` - Start production environment
- `npm run docker:build` - Build all Docker images
- `npm run docker:deploy` - Deploy to staging/production
- `npm run docker:health` - Run health checks
- `npm run docker:logs` - View service logs
- `npm run docker:backup` - Create database backup