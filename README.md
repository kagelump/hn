# Hacker News Reader

A modern, multiplatform JavaScript webapp for reading Hacker News.

## Features

- Browse Hacker News front page
- Read articles and comments
- Filter by Ask HN, Show HN, and Top posts
- Dark theme support
- Offline caching
- Mobile-friendly responsive design

## Development

This project has been modernized with:
- **TypeScript** for type safety
- **Vite** for fast builds and hot module replacement
- **Modern ES modules** instead of legacy script loading
- **ESLint** for code quality

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
npm install
```

### Development Server

```bash
npm run dev
```

This starts a development server at `http://localhost:3000` with hot module replacement.

### Build for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

### Type Checking

```bash
npm run type-check
```

### Linting

```bash
npm run lint
```

## Configuration

Data source URLs can be configured in `src/config.ts`:

```typescript
url: {
  stories: "http://ng.premii.com:8080",
  readability: "a/read/sample.txt"
}
```

## Technology Stack

- TypeScript
- Vite
- Modern JavaScript (ES2020+)
- CSS3
- LocalStorage for offline caching
- Fetch API for HTTP requests

## Legacy Links

- Original Web: http://hn.premii.com
- iOS: https://itunes.apple.com/us/app/hacker-news-yc/id713733435
- Android: https://play.google.com/store/apps/details?id=com.premii.hn

## Credits

- Icon font - http://icomoon.io
- Normalize.css - https://github.com/necolas/normalize.css/
- Unofficial Hacker News API - https://github.com/cheeaun/node-hnapi/

## License

MIT

