# Config Package - Development Guidelines

## Purpose

This package contains shared configuration files, build tools setup, and environment management utilities used across all applications and packages in the monorepo.

## Package Structure

```
packages/config/
├── src/
│   ├── environments/     # Environment-specific configurations
│   │   ├── development.ts
│   │   ├── staging.ts
│   │   ├── production.ts
│   │   └── index.ts
│   ├── build/           # Build configuration utilities
│   │   ├── webpack.ts   # Webpack configurations
│   │   ├── vite.ts      # Vite configurations
│   │   ├── rollup.ts    # Rollup configurations
│   │   └── index.ts
│   ├── linting/         # Linting configurations
│   │   ├── eslint.ts    # ESLint configurations
│   │   ├── prettier.ts  # Prettier configurations
│   │   └── index.ts
│   ├── testing/         # Testing configurations
│   │   ├── jest.ts      # Jest configurations
│   │   ├── playwright.ts # Playwright configurations
│   │   └── index.ts
│   ├── typescript/      # TypeScript configurations
│   │   ├── base.json    # Base TypeScript config
│   │   ├── web.json     # Web-specific config
│   │   ├── api.json     # API-specific config
│   │   └── mobile.json  # Mobile-specific config
│   └── index.ts         # Main exports
├── configs/             # Configuration files
│   ├── .eslintrc.js
│   ├── .prettierrc.js
│   ├── jest.config.js
│   ├── playwright.config.ts
│   └── tailwind.config.js
├── package.json
└── CLAUDE.md           # This file
```

## Environment Configuration

### Configuration Structure
- **Environment-specific configs** for development, staging, production
- **Type-safe interfaces** for all configuration sections
- **Validation and defaults** for all environment variables
- **App-specific overrides** for web, API, mobile applications

See `src/environments/` for complete configuration definitions.

### Key Configurations
- **Development**: Local services, debug logging, relaxed security
- **Production**: Optimized performance, strict security, SSL enabled  
- **Environment Variables**: Validated with Zod schemas
- **App Overrides**: Specific configurations for web/API/mobile

## Build Configurations

### Vite (Web App)
- **Plugins**: React, TypeScript path resolution
- **Development**: Hot reload, proxy for API calls
- **Production**: Code splitting, sourcemaps, optimized chunks
- **CSS Modules**: Scoped styles with hash generation

### TypeScript Configurations
- **Base Config**: ES2020, strict mode, path mapping for monorepo packages
- **Web App**: DOM types, React JSX, Vite client types
- **API Server**: Node types, CommonJS modules, decorator support
- **Mobile**: React Native types, Metro bundler configuration

Configuration files available in `typescript/` directory.

## Linting Configuration

### ESLint
- **Base Rules**: TypeScript, React, accessibility, import order
- **Custom Rules**: No console logs, prefer const, no unused vars
- **Test Overrides**: Relaxed rules for test files
- **Import Order**: External → internal → relative imports

### Prettier  
- **Code Style**: Single quotes, trailing commas, 100 char width
- **File-Specific**: JSON/YAML (2 spaces), Markdown (80 chars)
- **Integration**: Works with ESLint via prettier plugin

## Testing Configuration

### Jest (Unit/Integration)
- **Environment**: jsdom for React components
- **Coverage**: 80% threshold for branches, functions, lines
- **Module Mapping**: Path aliases for monorepo packages
- **Setup**: Test utilities and mocks

### Playwright (E2E)
- **Browsers**: Chrome, Firefox, Safari (desktop + mobile)
- **Parallel Execution**: Full parallelization with CI optimizations  
- **Screenshots**: On failure, traces on retry
- **Test Server**: Automatic dev server startup

## Configuration Management

### Environment Validation
- **Zod Schemas**: Runtime validation of all environment variables
- **Type Safety**: Fully typed configuration objects  
- **Factory Pattern**: Environment-specific and app-specific configs
- **Validation**: Startup-time validation with clear error messages

### Usage Examples
```typescript
// Environment validation and config creation
import { ConfigFactory, validateEnvironment } from '@motion-detector/config';

const env = validateEnvironment();
export const config = ConfigFactory.createForApp('web', env.NODE_ENV);
```

## Development Commands

- `npm run build:config` - Build configuration package
- `npm run test:config` - Run configuration tests
- `npm run validate:config` - Validate all configuration files
- `npm run lint:config` - Run linting for configuration files