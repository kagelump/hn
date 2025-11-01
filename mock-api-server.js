/**
 * Mock API Server for Hacker News Reader Development
 * 
 * This server provides mock data to replace the dead ng.premii.com:8080 endpoint.
 * Run with: node mock-api-server.js
 */

import http from 'http';

// Mock Hacker News data
const mockStories = [
  {
    id: 1,
    title: "Welcome to Hacker News Reader",
    points: 100,
    user: "demo",
    time_ago: "1 hour ago",
    url: "https://news.ycombinator.com",
    domain: "ycombinator.com",
    comments_count: 42,
    type: "link"
  },
  {
    id: 2,
    title: "TypeScript 5.3 Released with New Features",
    points: 250,
    user: "typescript",
    time_ago: "2 hours ago",
    url: "https://devblogs.microsoft.com/typescript",
    domain: "microsoft.com",
    comments_count: 89,
    type: "link"
  },
  {
    id: 3,
    title: "Show HN: My New Project",
    points: 75,
    user: "builder",
    time_ago: "3 hours ago",
    url: "https://github.com/example/project",
    domain: "github.com",
    comments_count: 23,
    type: "link"
  },
  {
    id: 4,
    title: "Ask HN: What are you working on?",
    points: 150,
    user: "curious",
    time_ago: "4 hours ago",
    comments_count: 156,
    type: "ask"
  },
  {
    id: 5,
    title: "The Future of Web Development",
    points: 320,
    user: "webdev",
    time_ago: "5 hours ago",
    url: "https://web.dev/blog/future",
    domain: "web.dev",
    comments_count: 234,
    type: "link"
  },
  {
    id: 6,
    title: "New AI Model Achieves State of the Art Results",
    points: 450,
    user: "researcher",
    time_ago: "6 hours ago",
    url: "https://arxiv.org/abs/example",
    domain: "arxiv.org",
    comments_count: 312,
    type: "link"
  },
  {
    id: 7,
    title: "Vite 5.0 - Next Generation Frontend Tooling",
    points: 180,
    user: "vitejs",
    time_ago: "7 hours ago",
    url: "https://vitejs.dev",
    domain: "vitejs.dev",
    comments_count: 67,
    type: "link"
  },
  {
    id: 8,
    title: "Show HN: I built a productivity app",
    points: 95,
    user: "maker",
    time_ago: "8 hours ago",
    url: "https://example.com/app",
    domain: "example.com",
    comments_count: 34,
    type: "link"
  },
  {
    id: 9,
    title: "Understanding JavaScript Closures",
    points: 220,
    user: "educator",
    time_ago: "9 hours ago",
    url: "https://javascript.info/closure",
    domain: "javascript.info",
    comments_count: 78,
    type: "link"
  },
  {
    id: 10,
    title: "Ask HN: Best resources for learning Rust?",
    points: 125,
    user: "learner",
    time_ago: "10 hours ago",
    comments_count: 145,
    type: "ask"
  }
];

// Mock comments for an item
const mockComments = {
  id: 1,
  title: "Welcome to Hacker News Reader",
  points: 100,
  user: "demo",
  time_ago: "1 hour ago",
  url: "https://news.ycombinator.com",
  domain: "ycombinator.com",
  comments_count: 2,
  type: "link",
  comments: [
    {
      id: 101,
      user: "commenter1",
      time_ago: "30 minutes ago",
      content: "This is great! Thanks for sharing.",
      comments: [
        {
          id: 102,
          user: "commenter2",
          time_ago: "20 minutes ago",
          content: "I agree, very useful!",
          comments: []
        }
      ]
    },
    {
      id: 103,
      user: "commenter3",
      time_ago: "45 minutes ago",
      content: "Interesting project. Looking forward to more updates.",
      comments: []
    }
  ]
};

const PORT = 8080;

const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  
  // Handle /news endpoint (list of stories)
  if (url.pathname === '/news') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(mockStories));
    return;
  }
  
  // Handle /item/{id} endpoint (individual story with comments)
  const itemMatch = url.pathname.match(/^\/item\/(\d+)$/);
  if (itemMatch) {
    const itemId = parseInt(itemMatch[1], 10);
    const item = mockStories.find(s => s.id === itemId);
    
    if (item) {
      // Return item with mock comments
      const itemWithComments = {
        ...item,
        comments: itemId === 1 ? mockComments.comments : []
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(itemWithComments));
      return;
    }
  }
  
  // Not found
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`Mock API server running on http://localhost:${PORT}`);
  console.log(`Endpoints:`);
  console.log(`  GET /news - List of stories`);
  console.log(`  GET /item/{id} - Individual story with comments`);
});
