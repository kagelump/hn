# Migration Guide

## Overview

This Hacker News reader has been modernized from a legacy 12-year-old codebase to use current best practices and tooling.

## Key Changes

### Build System
- **Before**: No build system, direct script loading
- **After**: Vite for fast development and optimized production builds

### Language
- **Before**: Vanilla JavaScript with IIFE patterns
- **After**: TypeScript with ES modules for type safety and better IDE support

### Module System
- **Before**: Global `window.$hn` object with self-executing functions
- **After**: ES modules with proper imports/exports

### Dependencies
- **Before**: Bundled Zepto.js, FastClick, jQuery.cookie in `lib.js` (1155 lines)
- **After**: Modern alternatives:
  - Native Fetch API (replaces Zepto AJAX)
  - Native cookie handling with `js-cookie` library
  - Custom lightweight PubSub implementation
  - No jQuery/Zepto dependency

### Project Structure

```
├── src/
│   ├── types/          # TypeScript type definitions
│   │   └── index.ts
│   ├── utils/          # Utility functions
│   │   ├── pubsub.ts   # Event system
│   │   ├── storage.ts  # LocalStorage wrapper
│   │   ├── template.ts # Template rendering
│   │   └── time.ts     # Time utilities
│   ├── modules/        # Core application modules
│   │   ├── data.ts     # API & caching layer
│   │   ├── performance.ts
│   │   └── ui.ts       # UI components
│   ├── styles/         # CSS files
│   ├── config.ts       # Application configuration
│   └── main.ts         # Application entry point
├── public/             # Static assets (icons, fonts)
├── dist/              # Production build output
└── index.html         # Main HTML file
```

## Development Workflow

### Install Dependencies
```bash
npm install
```

### Development Server
```bash
npm run dev
```
Starts Vite dev server with hot module replacement at http://localhost:3000

### Type Checking
```bash
npm run type-check
```
Runs TypeScript compiler in check mode

### Linting
```bash
npm run lint
```
Runs ESLint on all TypeScript files

### Production Build
```bash
npm run build
```
Creates optimized production build in `dist/` directory

### Preview Production Build
```bash
npm run preview
```
Serves the production build locally for testing

## Configuration

Update API endpoints in `src/config.ts`:

```typescript
export const config: AppConfig = {
  url: {
    stories: 'http://ng.premii.com:8080',
    readability: 'a/read/sample.txt'
  },
  // ...
};
```

## Browser Support

Modern browsers with ES2020 support:
- Chrome/Edge 80+
- Firefox 72+
- Safari 13.1+
- Mobile browsers (iOS Safari 13.4+, Chrome Android 80+)

## Performance

The modernized build produces much smaller bundles:
- **CSS**: 31.25 KB (15.70 KB gzipped)
- **JavaScript**: 11.18 KB (4.71 KB gzipped)
- **HTML**: 4.14 KB (1.10 KB gzipped)

Total: ~21 KB gzipped vs. legacy bundled libraries alone were 1155 lines of minified code.

## TypeScript Benefits

1. **Type Safety**: Catch errors at compile time
2. **Better IDE Support**: Autocomplete, refactoring, go-to-definition
3. **Self-Documenting Code**: Types serve as inline documentation
4. **Easier Refactoring**: Compiler helps find all usages

## Migration from Legacy Code

### Global Access
Legacy code used `window.$hn` for everything. The new code still exports this for compatibility but uses proper imports internally.

```typescript
// Legacy
window.$hn.data.getArticles(callback);

// Modern (internal)
import { data } from './modules/data';
data.getArticles(callback);
```

### Template Rendering
Both old and new template systems are available:

```typescript
import { template, prerender } from './utils/template';

// Runtime template
const html = template('<h1>{title}</h1>', { title: 'Hello' });

// Pre-compiled template (faster)
const render = prerender('<h1>{title}</h1>');
const html = render({ title: 'Hello' });
```

### PubSub Events
The event system remains similar:

```typescript
import { PubSub } from './utils/pubsub';

PubSub.subscribe('load-home', () => {
  // handle event
});

PubSub.publish('load-home');
```

## Testing

Currently, the project does not include automated tests. Consider adding:
- Unit tests with Vitest
- E2E tests with Playwright
- Component tests as needed

## Future Improvements

Potential enhancements:
1. Add automated tests
2. Implement service worker for offline support
3. Add PWA manifest
4. Implement virtual scrolling for better performance
5. Add TypeScript strict mode throughout
6. Consider migrating to a modern framework (React, Vue, Svelte)
7. Add proper error boundaries and error handling
8. Implement proper state management
