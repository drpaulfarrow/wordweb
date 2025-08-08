# WordWeb – Interactive Mind Map

Explore any word through definitions, synonyms, antonyms, idioms, translations, conjugations, pop culture and rhymes in an interactive mind map.

## Tech
- Front-end: React + Vite + D3
- Back-end: Express (Node.js), Axios, LRU cache

## Development

Install dependencies and run both servers:

```bash
npm install
npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:5174 (proxied to /api from the frontend)

## Features (MVP)
- Brain-shaped central node with animated branches for 8 categories
- Zoom/pan, click to expand, hover tooltips
- Aggregated API with caching

## License
MIT
