import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

// Middleware
app.use('*', cors());

// Health check endpoint
app.get('/health', (c) => {
  return c.json(
    {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '0.0.1',
    },
    200
  );
});

// Root endpoint
app.get('/', (c) => {
  return c.json(
    {
      message: 'Orbitchat API',
      version: '0.0.1',
      docs: 'See docs/api-spec.md',
    },
    200
  );
});

// Not found handler
app.notFound((c) => {
  return c.json(
    {
      code: 'NOT_FOUND',
      message: 'Endpoint not found',
      timestamp: new Date().toISOString(),
    },
    404
  );
});

// Error handler
app.onError((err, c) => {
  console.error('Error:', err);
  return c.json(
    {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      timestamp: new Date().toISOString(),
    },
    500
  );
});

const port = process.env.PORT || 3001;

export default {
  port,
  fetch: app.fetch,
};

console.log(`✅ Server running at http://localhost:${port}`);
