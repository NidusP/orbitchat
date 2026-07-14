# Phase 3 + Agent Closeout

> **状态**：开发完成，E2E 已覆盖，可准备 PR  
> **日期**：2026-07-03  
> **分支**：`feat/phase-3-agent`

---

## 交付范围

本阶段合并交付 Phase 3A 私聊、Phase 4A AI Chat MVP，以及 Phase 4B `send_dm` 汇合点。

### Phase 3A：1:1 私聊

- `conversations` / `conversation_members` / `messages` Drizzle schema 与 migration。
- `/api/v1/conversations` REST：
  - 会话列表。
  - 创建或获取 1:1 会话。
  - 单会话详情。
  - 历史消息。
  - 发送消息。
  - 标记已读。
- `WS /ws/v1/chat`：
  - JWT + Session 鉴权。
  - 浏览器 query fallback：`deviceId` / `platform`。
  - `connection.ready`、`message.new`、`message.read`、`ping/pong`。
- Web：
  - `/messages` 会话列表。
  - `/messages/[id]` 聊天窗。
  - 用户 Profile 的 Message 入口。
  - 会话未读数与实时预览更新。

### Phase 4A：AI Chat MVP

- `agents` / `ai_conversations` / `ai_messages` Drizzle schema 与 migration。
- 本地模型配置：
  - `LLM_BASE_URL`
  - `LLM_MODEL`
  - `LLM_TIMEOUT_MS`
  - `AI_MAX_CONCURRENT_RUNS`
- OpenAI-compatible provider，默认面向 Ollama / vLLM / llama.cpp server。
- `/api/v1/ai/*`：
  - Agent 列表。
  - AI 会话列表与创建。
  - AI 历史消息。
  - SSE 流式消息回复。
- Web `/ai`：
  - Agent 选择。
  - AI 会话列表。
  - SSE delta 渲染。
  - Tool 结果展示。
- 只读 Tool：
  - `search_contact` 复用 Phase 2 用户搜索。

### Phase 4B 汇合：`send_dm`

- `ai_tool_calls` Drizzle schema 与 migration。
- Agent 检测 `send_dm` 意图时只生成 pending tool call，不直接写业务消息。
- 用户在 `/ai` 确认或拒绝 pending action。
- Approve 后通过 Phase 3A `message-service` 发送私聊。
- 审计状态：`pending` / `approved` / `rejected` / `executed` / `failed`。

---

## 验证记录

已通过：

```bash
pnpm type-check
pnpm --filter @orbitchat/server test
pnpm lint
pnpm --filter @orbitchat/web build
pnpm --filter @orbitchat/server db:migrate
git diff --check
```

结果：

- Server tests：68 pass。
- Web build：`/ai`、`/messages`、`/messages/[id]` 均进入 Next build 产物。
- DB migrations：`0003`、`0004`、`0005` 已在本地应用成功。
- API smoke：
  - 登录测试账号成功。
  - `/api/v1/conversations` 返回 `SUCCESS`。
  - `/api/v1/ai/agents` 返回 `SUCCESS` 且 seed 出内置 Agent。

E2E 新增：

- `apps/web/e2e/chat-agent-flow.spec.ts`
  - 双用户创建私聊、发送消息、另一端看到消息。
  - 登录用户打开 `/ai` 并创建 AI 会话。

```bash
CI=true pnpm exec playwright test chat-agent-flow.spec.ts
```

结果（2026-07-03）：

- 2/2 通过（私聊用例在 CI 重试下可能因搜索索引延迟标记为 flaky，已加长等待）。
- `playwright.config.ts` Web 端改为 `build && start`（端口 3100），避免与本机 `next dev`（3000）单实例锁冲突。

---

## 本地验收步骤

### 私聊

1. `pnpm dev`
2. 注册用户 A 和用户 B。
3. A 打开 B 的用户页，点击 **Message**。
4. B 打开 `/messages`。
5. A 发送消息，B 应在列表和聊天窗看到消息。

### AI Chat

1. 启动本地模型服务，例如 Ollama OpenAI-compatible API。
2. 配置：

```bash
LLM_BASE_URL=http://localhost:11434/v1
LLM_MODEL=llama3.2
```

3. 打开 `/ai`，点击 **New chat**。
4. 发送：

```text
Tell me a joke
```

5. 测试只读工具：

```text
search_contact: test
```

6. 测试写操作确认：

```text
send_dm to test_popolus: hello from agent
```

页面应出现确认卡片；Approve 后消息进入普通私聊。

---

## 已接受 ADR

- [ADR 13 — WebSocket 栈与连接管理](./decisions/13-websocket-stack.md)
- [ADR 14 — 消息写入与实时投递模型](./decisions/14-message-delivery.md)
- [ADR 15 — 1:1 会话与消息模型](./decisions/15-conversation-model.md)
- [ADR 17 — AI Agent 架构、本地模型与 Runtime 边界](./decisions/17-ai-agent-architecture.md)

---

## 剩余风险

- 本地模型服务不可用时，AI SSE 会返回错误事件；这不影响 P3 私聊。
- 4A runtime 是轻量单轮 orchestrator，未引入 LangGraph / RAG。
- 3A 未做 Redis Pub/Sub，多实例广播仍是后续部署议题。
- 3A 未做 typing、群聊、移动推送；分别留给 3B / 3.1。
- `send_dm` 目前通过简单文本意图触发，后续可升级为结构化 tool schema。

---

## 下一步

1. 合并 PR（`feat/phase-3-agent` → `master`）。
2. 按 [phase-3-4-next-plan.md](./phase-3-4-next-plan.md) 推进 **Track M（3B 群聊）** 与 **Track A（4B Tool 扩展）** — 可并行。
3. 3B 启动前撰写 **ADR 16**（群聊模型）。

