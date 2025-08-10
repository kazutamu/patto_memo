# UI Package - Development Guidelines

## Purpose

This package contains reusable UI components, design system, and styling utilities shared across all applications. It provides a consistent user experience and design language throughout the motion detector platform.

## Package Structure

```
packages/ui/
├── src/
│   ├── components/       # Reusable UI components
│   │   ├── motion/       # Motion-specific components
│   │   ├── forms/        # Form components
│   │   ├── feedback/     # Alerts, notifications, loading states
│   │   ├── layout/       # Layout components
│   │   └── index.ts      # Component exports
│   ├── hooks/            # Custom React hooks
│   │   ├── useTheme.ts   # Theme management
│   │   ├── useAnimation.ts # Animation utilities
│   │   └── index.ts      # Hook exports
│   ├── styles/           # Shared styles and themes
│   │   ├── globals.css   # Global styles
│   │   ├── variables.css # CSS custom properties
│   │   ├── themes/       # Theme definitions
│   │   └── animations/   # Animation definitions
│   ├── utils/            # Style utilities
│   │   ├── classnames.ts # Class name utilities
│   │   ├── responsive.ts # Responsive utilities
│   │   └── index.ts      # Utility exports
│   └── index.ts          # Main package exports
├── package.json
├── tsconfig.json
└── CLAUDE.md            # This file
```

## Design System

### Theme Architecture

```typescript
export interface Theme {
  colors: {
    primary: ColorScale;
    secondary: ColorScale;
    accent: ColorScale;
    neutral: ColorScale;
    semantic: SemanticColors;
    motion: MotionColors;
  };
  typography: Typography;
  spacing: Spacing;
  breakpoints: Breakpoints;
  animations: Animations;
  shadows: Shadows;
  borders: Borders;
}

export interface ColorScale {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string; // Base color
  600: string;
  700: string;
  800: string;
  900: string;
}

export interface MotionColors {
  active: string;        // Motion detected state
  inactive: string;      // No motion state
  alert: string;         // Alert/warning color
  confidence: {          // Confidence level colors
    low: string;         // Red for low confidence
    medium: string;      // Yellow for medium confidence
    high: string;        // Green for high confidence
  };
}
```

### Dark Theme Implementation

```css
/* Dark theme with neon accents */
:root[data-theme="dark"] {
  /* Primary colors - Cyan/Blue */
  --color-primary-50: #ecfeff;
  --color-primary-100: #cffafe;
  --color-primary-500: #06b6d4; /* Base cyan */
  --color-primary-700: #0891b2;
  --color-primary-900: #164e63;

  /* Accent colors - Purple */
  --color-accent-500: #8b5cf6; /* Base purple */
  --color-accent-600: #7c3aed;
  --color-accent-700: #6d28d9;

  /* Background colors */
  --color-bg-primary: #0f172a;    /* Slate 900 */
  --color-bg-secondary: #1e293b;  /* Slate 800 */
  --color-bg-tertiary: #334155;   /* Slate 700 */

  /* Motion-specific colors */
  --color-motion-active: #00ff88;    /* Bright green */
  --color-motion-inactive: #64748b;  /* Neutral gray */
  --color-motion-alert: #ff6b6b;     /* Red alert */
  
  /* Glass morphism effects */
  --glass-bg: rgba(255, 255, 255, 0.05);
  --glass-border: rgba(255, 255, 255, 0.1);
  --glass-backdrop: blur(12px);
}
```

## Core Components

- **Toggle** - Motion detection on/off with smooth animations and glow effects
- **SensitivitySlider** - Color-coded gradient slider (green→yellow→red)  
- **AlertPopup** - Modern card notifications with auto-dismiss and confidence scores
- **AIAnalysisCard** - Typewriter animation with confidence bars and categories

### Usage
```typescript
import { Toggle, SensitivitySlider, AlertPopup, AIAnalysisCard } from '@motion-detector/ui';
// See src/components/ for complete implementations
```

## Animation System

### Key Animations
- **Glass Morphism**: Background blur with subtle borders
- **Motion Glow**: Pulsing effects when motion detected
- **Typewriter**: Text reveal animation for AI analysis
- **Smooth Transitions**: 0.3s cubic-bezier easing

### Custom Hooks
- `useAnimation()` - Trigger animation states
- `useTypingAnimation()` - Text reveal effects
- `useResponsive()` - Breakpoint management

### CSS Classes
- `.glass` - Glass morphism background
- `.motion-glow` - Pulsing glow for active motion
- `.transition-smooth` - Standard 0.3s transitions
- `.slide-in` - Slide animation from top
- `.typing-cursor` - Blinking cursor animation

## Responsive Design

### Breakpoints
- **xs**: 320px (mobile)
- **sm**: 640px (large mobile)  
- **md**: 768px (tablet)
- **lg**: 1024px (desktop)
- **xl**: 1280px+ (large desktop)

### Testing
- `renderWithTheme()` - Component testing with theme provider
- `mockMotionEvent()` - Mock motion event data
- `mockAIAnalysis()` - Mock AI analysis data

## Development Commands

- `npm run build:ui` - Build UI package
- `npm run test:ui` - Run UI component tests
- `npm run lint:ui` - Run linting for UI components
- `npm run storybook` - Start Storybook development server
- `npm run storybook:build` - Build Storybook documentation