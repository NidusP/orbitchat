/**
 * Local smoke test for P3 + Agent (API level).
 * Usage: bun run scripts/smoke-p3-agent.ts
 */

const API = process.env.API_URL ?? 'http://localhost:3001';
const DEVICE_ID = 'e2e-smoke-device-001';

const headers = {
  'Content-Type': 'application/json',
  'X-Client-Platform': 'web',
  'X-Client-Version': '0.0.0',
  'X-Device-Id': DEVICE_ID,
};

type Success<T> = { code: 'SUCCESS'; data: T };

async function api<T>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const { token, ...init } = options;
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      ...headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  const body = (await res.json().catch(() => null)) as
    | Success<T>
    | { code: string; message: string }
    | null;

  if (!res.ok) {
    throw new Error(`${path} → ${res.status}: ${JSON.stringify(body)}`);
  }
  if (!body || body.code !== 'SUCCESS') {
    throw new Error(`${path} → unexpected body: ${JSON.stringify(body)}`);
  }
  return body.data;
}

async function registerUser(
  suffix: string
): Promise<{ token: string; username: string; email: string }> {
  const username = `smoke_${suffix}`.slice(0, 32);
  const email = `smoke-${suffix}@example.com`;
  const password = 'Password123!';

  const registered = await api<{ user: { username: string } }>('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      username,
      email,
      displayName: `Smoke ${suffix}`,
      password,
    }),
  });

  const token = await login(email, password);
  return { token, username: registered.user.username, email };
}

async function login(email: string, password: string): Promise<string> {
  const data = await api<{ accessToken: string }>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, trustDevice: true }),
  });
  return data.accessToken;
}

async function testAiChat(token: string): Promise<void> {
  console.log('\n[4A] AI agents + LLM reply');
  const agents = await api<Array<{ id: string; name: string; slug: string }>>(
    '/api/v1/ai/agents',
    { token }
  );
  const agent = agents.find((a) => a.slug === 'orbit-guide');
  if (!agent) throw new Error('orbit-guide agent not found');
  console.log(`  ✓ agents (${agents.length}), 小轨 id=${agent.id.slice(0, 8)}…`);

  const conversation = await api<{ id: string }>('/api/v1/ai/conversations', {
    method: 'POST',
    token,
    body: JSON.stringify({ agentId: agent.id }),
  });
  console.log(`  ✓ created conversation ${conversation.id.slice(0, 8)}…`);

  const res = await fetch(
    `${API}/api/v1/ai/conversations/${conversation.id}/messages`,
    {
      method: 'POST',
      headers: {
        ...headers,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: 'Reply with exactly: pong' }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AI SSE failed: ${res.status} ${err}`);
  }

  const raw = await res.text();
  const hasDelta = raw.includes('message.delta');
  const hasDone = raw.includes('message.done');
  const hasError = raw.includes('"type":"error"') || raw.includes('event: error');

  if (hasError) {
    throw new Error(`AI SSE returned error: ${raw.slice(0, 500)}`);
  }
  if (!hasDelta || !hasDone) {
    throw new Error(`AI SSE incomplete: delta=${hasDelta} done=${hasDone}`);
  }

  const doneMatch = raw.match(/event: message\.done[\s\S]*?data: ({[^}]+})/);
  const snippet = doneMatch?.[1]?.slice(0, 120) ?? raw.slice(-200);
  console.log(`  ✓ LLM SSE stream ok (message.done received)`);
  console.log(`    snippet: ${snippet}…`);
}

async function testSendDm(
  token: string,
  targetUsername: string
): Promise<void> {
  console.log('\n[4B] send_dm pending → approve');
  const agents = await api<Array<{ id: string }>>('/api/v1/ai/agents', { token });
  const agentId = agents[0]?.id;
  if (!agentId) throw new Error('no agent');

  const conversation = await api<{ id: string }>('/api/v1/ai/conversations', {
    method: 'POST',
    token,
    body: JSON.stringify({ agentId }),
  });

  const dmContent = `smoke dm ${Date.now()}`;
  const res = await fetch(
    `${API}/api/v1/ai/conversations/${conversation.id}/messages`,
    {
      method: 'POST',
      headers: {
        ...headers,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: `send_dm to ${targetUsername}: ${dmContent}`,
      }),
    }
  );
  const sse = await res.text();
  if (!sse.includes('tool.call')) {
    throw new Error(`send_dm did not emit tool.call: ${sse.slice(0, 400)}`);
  }
  console.log('  ✓ send_dm triggered tool.call SSE');

  const toolCalls = await api<{ items: Array<{ id: string; status: string }> }>(
    `/api/v1/ai/conversations/${conversation.id}/tool-calls?limit=10`,
    { token }
  );
  const pending = toolCalls.items.find((t) => t.status === 'pending');
  if (!pending) throw new Error('no pending tool call');

  await api(`/api/v1/ai/tool-calls/${pending.id}/approve`, {
    method: 'POST',
    token,
  });
  console.log(`  ✓ approved tool call ${pending.id.slice(0, 8)}…`);

  const convos = await api<{ items: Array<{ id: string }> }>(
    '/api/v1/conversations?limit=20',
    { token }
  );
  if (convos.items.length === 0) {
    throw new Error('no conversations after send_dm approve');
  }
  const directId = convos.items[0]?.id;
  const messages = await api<{ items: Array<{ content: string }> }>(
    `/api/v1/conversations/${directId}/messages?limit=20`,
    { token }
  );
  const found = messages.items.some((m) => m.content.includes(dmContent));
  if (!found) {
    throw new Error(`DM content not found in conversation messages`);
  }
  console.log(`  ✓ DM delivered: "${dmContent}"`);
}

async function testP3DirectChat(
  tokenA: string,
  tokenB: string,
  targetUsername: string
): Promise<void> {
  console.log('\n[3A] direct chat REST');
  const users = await api<{ items: Array<{ id: string; username: string }> }>(
    `/api/v1/users/search?q=${encodeURIComponent(targetUsername)}&limit=5`
  );
  const target = users.items[0];
  if (!target) throw new Error('search target not found');

  const conversation = await api<{ id: string }>('/api/v1/conversations', {
    method: 'POST',
    token: tokenA,
    body: JSON.stringify({ participantUserId: target.id }),
  });
  console.log(`  ✓ direct conversation ${conversation.id.slice(0, 8)}…`);

  const msg = `P3 smoke ${Date.now()}`;
  const sent = await api<{ content: string }>(
    `/api/v1/conversations/${conversation.id}/messages`,
    {
      method: 'POST',
      token: tokenA,
      body: JSON.stringify({ content: msg }),
    }
  );
  if (sent.content !== msg) throw new Error('send message mismatch');
  console.log(`  ✓ A sent: "${msg}"`);

  const inbox = await api<{ items: Array<{ content: string }> }>(
    `/api/v1/conversations/${conversation.id}/messages?limit=10`,
    { token: tokenB }
  );
  const received = inbox.items.some((m) => m.content === msg);
  if (!received) throw new Error('B did not see message');
  console.log('  ✓ B received message via REST');
}

async function main(): Promise<void> {
  console.log('P3 + Agent smoke test');
  console.log(`API: ${API}`);

  const health = await fetch(`${API}/health`);
  if (!health.ok) throw new Error('/health failed');
  console.log('[infra] ✓ /health');

  const suffix = `${Date.now()}`;
  const userA = await registerUser(`a_${suffix}`);
  const userB = await registerUser(`b_${suffix}`);
  console.log(`[auth] ✓ registered ${userA.username} + ${userB.username}`);

  let testToken: string;
  try {
    testToken = await login('test@test.com', 'Password123!');
    console.log('[auth] ✓ test_popolus login');
  } catch {
    testToken = userA.token;
    console.log('[auth] test_popolus unavailable, using smoke user A');
  }

  await testP3DirectChat(userA.token, userB.token, userB.username);
  await testAiChat(testToken);
  await testSendDm(testToken, userB.username);

  console.log('\n✅ All smoke checks passed');
}

main().catch((err: unknown) => {
  console.error('\n❌ Smoke test failed:', err);
  process.exit(1);
});
