import { createBunWebSocket } from 'hono/bun';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { env } from './env';
import { handleError, handleNotFound } from './middleware/error';
import { registerChatWs } from './realtime/chat-ws';
import { v1Router } from './routes/v1';

const { upgradeWebSocket, websocket } = createBunWebSocket();

export const app = new Hono();

app.use(
  '*',
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  })
);

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

app.route('/api/v1', v1Router);

registerChatWs(app, upgradeWebSocket);

app.notFound(handleNotFound);
app.onError((err, c) => handleError(err, c));

const server = Bun.serve({
  port: env.PORT,
  fetch: app.fetch,
  websocket,
});

console.log(`✅ Server running at http://localhost:${server.port}`);
