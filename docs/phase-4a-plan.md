# Phase 4A 实施计划（AI Chat MVP）

> **状态**：**4A 已完成**；4B `send_dm` 汇合点已完成（2026-07-03）  
> **交付回顾**：[phase-3-agent-closeout.md](./phase-3-agent-closeout.md)  
> **4B 扩展 / 4C**：见 [phase-3-4-next-plan.md](./phase-3-4-next-plan.md)  
> **前置**：Phase 2 已完成；曾与 Phase 3A 并行交付

---

## 总览

Phase 4A 目标是交付一个可玩的 AI Chat MVP，而不是一次做完整 Agent 平台。

```mermaid
flowchart TB
  subgraph wave0 [Wave 0 - 文档与契约]
    ADR17[ADR 17 AI Agent 架构]
    API[api-spec AI 端点]
    DB[db-schema ai_* 表]
    ENV[env 本地模型变量]
  end

  subgraph wave1 [Wave 1 - 后端 MVP]
    DATA[agents / ai_conversations / ai_messages]
    RUNTIME[lib/agent-runtime]
    SSE[POST /api/v1/ai/* SSE]
  end

  subgraph wave2 [Wave 2 - Web 与验收]
    WEB[/ai 页面]
    GAME[小游戏与笑话]
    TEST[测试与文档交接]
  end

  wave0 --> wave1
  wave1 --> wave2
```

| 里程碑 | 目标 | 依赖 |
|--------|------|------|
| **4A** | 本地模型 AI Chat、闲聊、笑话、小游戏、只读联系人搜索 | 不依赖 Phase 3A |
| **4B** | Agent Tool 执行业务操作，如 `send_dm` | 依赖 Phase 3A `message-service` |
| **4C** | LangGraph / RAG / 独立 Python Runtime 评估 | 依赖真实复杂度 |

---

## Phase 4A 范围

### 做

- 本地模型服务接入（Ollama / vLLM / llama.cpp server，OpenAI-compatible API）。
- `agents`、`ai_conversations`、`ai_messages` 基础表。
- `/api/v1/ai/*` REST + SSE 流式回复。
- `apps/server/src/services/ai/*`：
  - AI 会话与消息落库。
  - Agent preset 选择。
  - Tool 执行入口。
- `apps/server/src/lib/agent-runtime/*`：
  - LLM provider。
  - Tool registry。
  - 简单 tool loop。
  - 游戏状态机。
- Web `/ai` 页面。
- 内置 Agent MVP：
  - 闲聊。
  - 讲笑话。
  - 井字棋等简单互动。
  - `search_contact` 只读 Tool。

### 不做

- 不实现 `send_dm`。
- 不实现写操作 Tool。
- 不新增 `WS /ws/v1/ai`。
- 不引入 LangChain / LlamaIndex。
- 不拆独立 Python Runtime。
- 不做 RAG、向量库、聊天记录语义搜索。

---

## Wave 0 - 文档与契约（可与 Phase 3 Wave 0 并行）

| 轨道 | 产出 | 依赖 |
|------|------|------|
| **AI-W0-A** | ADR 17 Accepted | 无 |
| **AI-W0-B** | `api-spec.md`：`/api/v1/ai/agents`、`/conversations`、`/messages`、SSE 事件 | ADR 17 |
| **AI-W0-C** | `db-schema.md`：`agents`、`ai_conversations`、`ai_messages` | ADR 17 |
| **AI-W0-D** | `env.md`：`LLM_BASE_URL`、`LLM_MODEL`、timeout、并发限制 | ADR 17 |
| **AI-W0-E** | `shared-types` 设计草案：`Agent`、`AiConversation`、`AiMessage` | API / DB 草案 |

**门禁**：4A 代码开工前，ADR 17 与 AI API / DB 契约必须评审通过。

---

## Wave 1 - 后端 MVP

### 数据与类型

| # | 任务 | 并行 |
|---|------|------|
| A1 | `shared-types` 新增 AI domain 与 API 类型 | 与 A2 并行 |
| A2 | Drizzle 新增 `agents`、`ai_conversations`、`ai_messages` | 与 A1 并行 |
| A3 | seed 一个系统 Agent（如“小轨”） | 依赖 A2 |

### Server

| # | 任务 | 并行 |
|---|------|------|
| B1 | `services/ai/conversation-service.ts`：会话与消息落库 | 依赖 A2 |
| B2 | `lib/agent-runtime/providers/ollama.ts` | 与 B1 并行 |
| B3 | `lib/agent-runtime/orchestrator.ts`：单轮 + 简单 tool loop | 依赖 B2 |
| B4 | `services/ai/tool-executor.ts`：只读 Tool 执行 | 依赖 B1 |
| B5 | `routes/v1/ai.ts`：REST + SSE | 依赖 B1/B3 |
| B6 | 单测：provider mock、tool executor、会话服务 | 与 B5 并行 |

### Runtime 约束

- Runtime 不直接 import Drizzle、Hono、`message-service`。
- Runtime 只依赖 `LLMProvider`、`ToolRegistry`、`ToolExecutor` 等接口。
- 写操作 Tool 即使在 4A 中被定义，也必须禁用。
- 模型请求必须有 timeout 与并发限制。

---

## Wave 2 - Web 与验收

| # | 任务 | 并行 |
|---|------|------|
| C1 | `apps/web/src/lib/api/ai.ts` | 依赖 B5 |
| C2 | `/ai` 对话页 + SSE token 渲染 | 依赖 C1 |
| C3 | Agent 选择 UI | 与 C2 并行 |
| C4 | 井字棋 / 简单游戏交互 UI | 与 C2 并行 |
| C5 | E2E：创建 AI 会话、收到回复、完成一局小游戏 | 依赖 C2/C4 |

### 4A 成功标准

- [ ] 本地模型服务可配置并被 AI 路由调用。
- [ ] 用户可创建 AI 会话并收到流式回复。
- [ ] `ai_messages` 持久化用户与 Agent 消息。
- [ ] Agent 可讲笑话并完成一个简单小游戏回合。
- [ ] `search_contact` 只读 Tool 可返回候选联系人。
- [ ] 普通 REST 与 Phase 3A WS 不依赖 AI Runtime。
- [ ] `pnpm type-check` / `lint` / `test` / `e2e` 通过。

---

## 与 Phase 3 的并行关系

| 工作 | 能否与 Phase 3A 并行 | 说明 |
|------|----------------------|------|
| ADR 17 / AI API / AI DB | ✅ | 可与 ADR 13-15 并行 |
| `ai_*` schema 与 shared-types | ✅ | 使用独立文件和独立 migration |
| AI REST + SSE | ✅ | 不依赖 WebSocket |
| `/ai` 页面 | ✅ | 不依赖 `/messages` |
| `search_contact` Tool | ✅ | 复用 Phase 2 用户搜索 |
| `send_dm` Tool | ❌ | 必须等 Phase 3A `message-service` |
| `WS /ws/v1/ai` | ❌ | 4A 不做，避免抢 Phase 3 WS 关键路径 |

---

## Phase 4B 汇合点

Phase 3A 验收通过后，4B 才能接入写操作 Tool：

- `send_dm`：通过 `message-service` 发私聊。
- `create_post`：可选，需用户确认。
- `follow_user` / `unfollow_user`：可选，需用户确认。
- `ai_tool_calls`：审计 Tool 输入、输出、状态、用户确认。
- Web 确认 UI：Agent 草拟操作，用户点击确认后执行。

写操作 Tool 的原则：

1. Runtime 不直接写库。
2. 所有写操作走 `services/ai/tool-executor.ts`。
3. 所有敏感操作必须写审计。
4. 失败应可恢复，不能吞掉业务错误。

---

## Runtime 演进

| 阶段 | 形态 | 触发条件 |
|------|------|----------|
| 4A | `apps/server/src/lib/agent-runtime` | MVP，轻量 tool loop |
| 4B+ | `packages/agent-core` | Tool / 游戏 / Agent preset 明显增多 |
| 4C+ | `apps/agent-runtime` 独立服务（优先 Python） | 长任务、多 Agent、LangGraph、RAG、主后端性能受影响 |

---

## 相关文档

| 文档 | 用途 |
|------|------|
| [decisions/17-ai-agent-architecture.md](./decisions/17-ai-agent-architecture.md) | AI 架构决策 |
| [phase-3-plan.md](./phase-3-plan.md) | Phase 3A 并行计划 |
| [api-spec.md](./api-spec.md) | AI HTTP/SSE 契约 |
| [db-schema.md](./db-schema.md) | AI 表结构 |
| [env.md](./env.md) | 本地模型配置 |

---

## 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| 0.1.0 | 2026-07-03 | 初版：4A/4B 拆分、与 Phase 3A 并行关系、Runtime 演进 |
