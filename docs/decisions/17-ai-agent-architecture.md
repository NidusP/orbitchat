# ADR 17：AI Agent 架构、本地模型与 Runtime 边界

- **状态**：Accepted
- **日期**：2026-07-03
- **阶段**：Phase 4A

## 背景

Orbitchat 计划在 Phase 4A 引入 AI Chat MVP：用户可与系统内置 Agent 对话，进行闲聊、讲笑话、小游戏等轻量互动；后续 Phase 4B 再接入 `send_dm` 等可执行系统操作的 Tool。

项目以学习为主，优先使用本地模型服务（如 Ollama / vLLM / llama.cpp server），避免在早期依赖云模型。同时，Phase 3 会引入私聊、WebSocket 与后续实时能力，AI 运行时不能影响主业务后端对聊天、直播信令等低延迟功能的服务质量。

## 选项

### 1. 全部在 `apps/server` 内实现

- 优点：开发快；复用现有 TypeScript、Hono、Drizzle、认证、shared-types；最少部署组件。
- 缺点：复杂 Agent loop、长任务、并发 SSE 可能影响主后端事件循环；后期迁移成本需要提前控制。

### 2. Day 1 使用独立 Python Agent Runtime 服务

- 优点：便于使用 LangGraph、LlamaIndex、RAG、评测与 Python AI 生态；进程隔离好。
- 缺点：早期复杂度高；需要服务间认证、内部 API、队列、部署与调试；学习重点容易从业务 Agent 变成微服务治理。

### 3. 分阶段：TS 同进程 MVP，保留独立 Runtime 演进路径

- 优点：4A 快速交付；代码边界清晰；后续可把 Runtime 抽到 `packages/agent-core` 或独立 Python 服务。
- 缺点：需要严格约束 4A 范围，避免把重 Agent 逻辑长期堆进主后端。

## 决策

选择 **选项 3：分阶段演进**。

Phase 4A：

- 模型推理使用独立本地模型服务，默认按 OpenAI-compatible HTTP API 调用。
- AI 控制面与业务服务留在 `apps/server`：
  - `routes/v1/ai.ts`：HTTP / SSE、鉴权、请求校验。
  - `services/ai/*`：AI 会话、消息落库、权限确认、Tool 审计、业务 Tool 执行。
- 轻量 Runtime 暂放 `apps/server/src/lib/agent-runtime/*`：
  - LLM provider 抽象。
  - Tool registry。
  - 简单 tool loop。
  - 游戏状态机。
- Phase 4A 使用 REST + SSE 做 AI 流式回复，不新增 `WS /ws/v1/ai`，避免抢 Phase 3 WebSocket 关键路径。

Phase 4B+：

- 当 Agent 能力变重，再评估迁移：
  1. 先抽到 `packages/agent-core`，供 server 或 worker 复用。
  2. 若出现长任务、多 Agent、RAG、LangGraph 需求，再拆 `apps/agent-runtime` 独立服务，优先考虑 Python。

## 原因

- **保护实时主线**：聊天、直播信令、Session 等低延迟能力仍由 `apps/server` 承担；模型推理不进入 Hono 进程。
- **学习路径清晰**：先理解 prompt、tool schema、tool result、权限、审计、状态机，再引入 LangGraph / LlamaIndex。
- **避免框架锁定**：先定义 Orbitchat 自己的 Tool 协议，后续可适配 LangGraph 或 LlamaIndex。
- **复用现有域服务**：`search_contact` 可复用 Phase 2 `searchUsers`；`send_dm` 在 Phase 4B 复用 Phase 3A `message-service`。

## Tool 权限原则

Tool 分三类：

| 类别 | 示例 | Phase | 权限 |
|------|------|-------|------|
| 只读 Tool | `search_contact`、读取公开资料 | 4A | 登录后可用，记录调用 |
| 娱乐 Tool | `tell_joke`、`play_tictactoe` | 4A | 不触碰业务数据，可直接执行 |
| 写操作 Tool | `send_dm`、`create_post`、关注/取关 | 4B+ | 必须用户确认，写入 `ai_tool_calls` 审计 |

敏感 Tool 不允许 Runtime 绕过 `apps/server` 直接写库。Runtime 只通过 `ToolExecutor` 接口请求执行，真实权限检查和业务操作由 `services/ai/tool-executor.ts` 完成。

## 本地模型约定

Phase 4A 新增环境变量：

```bash
LLM_BASE_URL=http://localhost:11434/v1
LLM_MODEL=qwen2.5:7b-instruct
LLM_TIMEOUT_MS=30000
AI_MAX_CONCURRENT_RUNS=2
```

本地模型服务可由开发者手动启动，也可在 `docker-compose.yml` 中追加可选 profile。`/health` 不依赖模型服务；AI 路由在模型不可用时返回可恢复错误。

## 框架策略

- Phase 4A 不引入 LangChain / LlamaIndex。
- 当出现多步骤、可暂停、可恢复的复杂 Agent 工作流时，优先评估 LangGraph。
- 当出现知识库、聊天记录语义检索、帖子/资料 RAG 时，再评估 LlamaIndex。

## 后续

- 新增 `docs/phase-4a-plan.md`，明确 4A / 4B 范围与并行关系。
- 在 `docs/api-spec.md` 补 `/api/v1/ai/*`。
- 在 `docs/db-schema.md` 展开 `agents`、`ai_conversations`、`ai_messages`、`ai_tool_calls`。
- 在 `docs/env.md` 补本地模型环境变量。
- Phase 4B 接入 `send_dm` 前，必须完成 Phase 3A `message-service` 验收。

## 相关文档

- [20-ai-sse-streaming.md](./20-ai-sse-streaming.md) — AI SSE 流式优化（`run.started`、真 token 流、`tool.started`、错误路径）
- [phase-4a-plan.md](../phase-4a-plan.md)
- [phase-4-orbit-guide-plan.md](../phase-4-orbit-guide-plan.md) — 小轨完善路线（Wave 0–5）
- [phase-4-agent-memory-rag-plan.md](../phase-4-agent-memory-rag-plan.md) — Memory / RAG / Fine-tuning 规划（M1+）
- [phase-3-plan.md](../phase-3-plan.md)
- [api-spec.md](../api-spec.md)
- [db-schema.md](../db-schema.md)
- [realtime-spec.md](../realtime-spec.md)
