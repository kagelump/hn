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

Start both the mock API server and the dev server:

```bash
# Terminal 1 - Start mock API server
npm run dev:api

# Terminal 2 - Start Vite dev server
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

### API Endpoint

**Important:** The original API endpoint (`http://ng.premii.com:8080`) is no longer accessible. For development, this project includes a mock API server.

#### Development Setup

1. Start the mock API server (in one terminal):
```bash
npm run dev:api
```

2. Start the development server (in another terminal):
```bash
npm run dev
```

The mock API server runs on `http://localhost:8080` and provides sample Hacker News data for testing.

#### Production Deployment

For production use, you'll need to:

1. Set up your own Hacker News API backend, or
2. Use an alternative API service such as:
   - Official Hacker News Firebase API: `https://hacker-news.firebaseio.com/v0/`
   - Algolia HN Search API: `https://hn.algolia.com/api/v1/`

3. Update the API endpoint in `src/config.ts`:

```typescript
url: {
  stories: "YOUR_API_ENDPOINT_HERE",
  readability: "a/read/sample.txt"
}
```

### API Format

The API expects the following endpoints:
- `GET /news` - Returns an array of story objects
- `GET /item/{id}` - Returns a single story with comments

See `mock-api-server.js` for the expected data format.

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

