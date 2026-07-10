# ADR 20：AI SSE 流式优化

## 背景

Phase 4A 已交付 `POST /api/v1/ai/conversations/:id/messages` 的 SSE 通道，但实现为 **「先跑完 Orchestrator + 落库，再按 80 字切块假流式」**，存在：

1. **TTFT 长**：LLM + Tool loop 期间客户端零事件
2. **错误路径分裂**：可预判错误应走 JSON；运行中错误走 SSE `error`；形状与 REST `ErrorResponse` 不完全一致
3. **Tool 无进度**：`tool.call` 在整轮结束后才推送
4. **上游已 stream**：`OpenAiCompatibleProvider` 对 Ollama 开 `stream: true`，但在内存拼完整段后才返回

本文档记录分阶段优化方案与验收标准。

## 决策

### 事件契约（扩展后）

| 事件 | 阶段 | 含义 |
|------|------|------|
| `run.started` | A | 连接已建立，服务端开始处理 |
| `tool.started` | C | 即将执行某 tool |
| `tool.call` | 已有 | tool 执行完成（含 output） |
| `message.delta` | B | LLM 文本增量（真 token/chunk） |
| `message.done` | 已有 | 本轮结束，assistant 已落库 |
| `error` | A | 运行中失败；payload 对齐 `ErrorResponse`（含 `timestamp`） |

### Phase A — 连接反馈与错误统一（优先）

**服务端**

- `streamSSE` 回调**首行**推 `run.started`
- 可预判错误在 **打开 SSE 前** 返回 JSON `ErrorResponse`：
  - `AI_BUSY`（429）
  - 会话不存在（404）
  - Zod 校验（400，已有 middleware）
- SSE `error.payload` 增加 `timestamp`；可选 `details`

**客户端**

- `!response.ok` 时用 `parseApiError` 解析 JSON 信封
- `sendAiMessageStream` 支持 `AbortSignal`
- `/ai` 页：`run.started` 显示「思考中…」；`error` 统一展示

### Phase B — 真流式（token 透传）

**Provider**

- `LlmProvider.chat` 增加 `chatStream(input, onChunk)` 或 `AsyncGenerator`
- 上游每个 `delta.content` 立即回调，不在 provider 内拼完整段

**Orchestrator**

- 无 tool：边收边 `yield` delta
- 有 tool：流暂停 → 执行 tool → `tool.started` / `tool.call` → 续下一轮 LLM

**Route / Service**

- `message.delta` 来自真实 chunk（可保留小缓冲，禁止整段 `chunkText`）
- assistant 消息仍在 `message.done` 前写入 DB（占位 + 最终 update 或一次性 insert）

### Phase C — Tool 进度

- Orchestrator 执行 tool 前发 `tool.started`（经 route 写 SSE）
- 与 `tool.call` 成对；Web 显示「正在查联系人…」等

### 不做（本 ADR）

- `WS /ws/v1/ai`
- 边流式边分段落库（断线恢复）
- 独立 `apps/agent-runtime` 服务

## 验收

| 阶段 | 验收 |
|------|------|
| A | `run.started` 在 LLM 调用前到达；`AI_BUSY` 返回 JSON 429；SSE `error` 含 `timestamp`；client abort 可取消 |
| B | 本地 Ollama 长回复：首 `message.delta` 早于 `message.done` ≥1s；无 `chunkText(80)` |
| C | 触发 `search_contact` 时先见 `tool.started` 再见 `tool.call` |

## 实施状态（2026-07-09）

| 阶段 | 状态 | 说明 |
|------|------|------|
| A | ✅ | `run.started`、`AI_BUSY` JSON 429、`error` 含 `timestamp`/`details`、client `AbortSignal` |
| B | ✅ | `chatStream` 透传上游 chunk；route 移除 `chunkText` |
| C | ✅ | `tool.started` + 实时 `tool.call`；Web 显示 tool 进度 |

## 相关

- [17-ai-agent-architecture.md](./17-ai-agent-architecture.md)
- [18-api-robustness.md](./18-api-robustness.md)
- [api-spec.md](../api-spec.md) — AI SSE 章节
