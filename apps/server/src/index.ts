import { createBunWebSocket } from 'hono/bun';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { env } from './env';
import { handleError, handleNotFound } from './middleware/error';
import { registerChatWs } from './realtime/chat-ws';
import { v1Router } from './routes/v1';
import { ensureBuiltinAgents } from './services/ai/conversation-service';
import { ensureHelpDocsIndexed } from './services/ai/rag-service';
import { ensureBucketOnStartup } from './services/storage-service';
import { startExpiredPendingUploadCleanup } from './services/upload-service';

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

void (async () => {
  try {
    await ensureBuiltinAgents();
    await ensureBucketOnStartup();
    startExpiredPendingUploadCleanup();
    if (env.RAG_ENABLED) {
      await ensureHelpDocsIndexed();
    }
  } catch (error: unknown) {
    console.error('[startup] agent seed, storage, or help-doc index failed:', error);
  }
})();
