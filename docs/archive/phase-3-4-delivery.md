# Phase 3–4 交付回顾（归档）

> **状态**：历史归档 · 已合入 `master`  
> **日期汇总**：2026-07-03（3A+4A）→ 2026-07-07（3B+4B）  
> **说明**：由原 `phase-3-agent-closeout` 与 `phase-3b-4b-closeout` **按阶段合并**；产品/API/DB 设计以现行活文档为准。  
> **当前迭代**：见 [phase-indie-product-plan.md](../phase-indie-product-plan.md)

设计契约仍以活文档为准：

- API：[api-spec.md](../api-spec.md)
- 实时：[realtime-spec.md](../realtime-spec.md)
- 库表：[db-schema.md](../db-schema.md)
- ADR：`docs/decisions/` 13–17、20–22 等

---

## 阶段总览

```text
Phase 3A  1:1 私聊 + WS
Phase 4A  AI Chat MVP + search_contact
    ↓
Phase 4B  send_dm 汇合（Approve）─── 同分支先行交付
    ↓
Phase 3B  群聊 MVP
Phase 3B.1 群管理 P0
Phase 3A.1 私聊 typing
Phase 4B+ Function Calling 写工具 + 井字棋
```

| 阶段 | 分支 / 合入 | 日期 |
|------|-------------|------|
| **3A + 4A + 4B `send_dm`** | `feat/phase-3-agent` | 2026-07-03 |
| **3B + 3B.1 + 3A.1 + 4B 扩展** | `feat/phase-3b-4b` → `master` | 2026-07-07 |

---

## Phase 3A — 1:1 私聊

### 交付

- 表：`conversations` / `conversation_members` / `messages` + migrations
- REST `/api/v1/conversations`：列表、创建/获取 1:1、详情、历史、发消息、已读
- `WS /ws/v1/chat`：JWT/Session、`connection.ready`、`message.new`、`message.read`、`ping/pong`
- Web：`/messages`、`/messages/[id]`、Profile Message 入口、未读与预览

### 当时未做（后续阶段承接）

- typing、群聊、推送、Redis 多实例 Pub/Sub

### ADR

- [ADR 13](../decisions/13-websocket-stack.md)、[14](../decisions/14-message-delivery.md)、[15](../decisions/15-conversation-model.md)

---

## Phase 4A — AI Chat MVP

### 交付

- 表：`agents` / `ai_conversations` / `ai_messages`
- 本地模型 env：`LLM_*`、`AI_MAX_CONCURRENT_RUNS`
- OpenAI-compatible provider（Ollama 等）
- REST `/api/v1/ai/*` + SSE 流式回复
- Web `/ai`：会话、delta、Tool 展示
- 只读 Tool：`search_contact`

### 当时局限

- 轻量 orchestrator；无 LangGraph / RAG（后由 Wave 2–3 补）

### ADR

- [ADR 17](../decisions/17-ai-agent-architecture.md)

---

## Phase 4B（汇合）— `send_dm` Approve

> 与 3A/4A 同波次合入；是写工具的最小闭环。

### 交付

- 表：`ai_tool_calls`
- pending → 用户 Approve/Reject → 复用 `message-service` 发私聊
- 审计：`pending` / `approved` / `rejected` / `executed` / `failed`

### 当时局限

- 文本意图触发；后续升级为结构化 Function Calling（见下节 **4B 扩展**）

---

## Phase 3B — 群聊 MVP

### 交付

- [ADR 16](../decisions/16-group-chat-model.md)：`conversations.type = 'group'`
- Migrations：`0006_group_chat`（及后续角色相关）
- 建群、群消息、列表、与 1:1 共用 REST/WS
- Web：`/messages/new-group` 等

---

## Phase 3B.1 — 群管理（P0）

### 交付

- 角色：`owner` / `admin` / `member`
- 加人、踢人、退群、转让群主、改群名
- Web：`/messages/[id]/settings`
- Migration：`0007_group_member_roles`

### 当时计划未做（后由 indie P1/P2 等承接部分）

- 群邀请链接、presence、群头像、群公告、消息编辑/删除  
  （历史详细任务单见 [phase-3b1-group-plan.md](./phase-3b1-group-plan.md)）

---

## Phase 3A.1 — 私聊 Typing

### 交付

- `typing.started` / `typing.stopped`（**仅 direct**；群聊不做 typing）
- Web typing 指示器

---

## Phase 4B 扩展 — FC 写工具 + 井字棋

### 交付

- OpenAI-compatible **Function Calling** + tool loop（最多 5 轮）
- 工具：

| 工具 | 类型 | 执行 |
|------|------|------|
| `search_contact` | 只读 | 立即 |
| `play_tictactoe` | 娱乐 | 立即；对局持久化 |
| `send_dm` | 写 | pending → Approve |
| `create_post` | 写 | pending → Approve |
| `follow_user` / `unfollow_user` | 写 | pending → Approve |

- `ai_conversations.tictactoe_data`；E2E mock 前缀
- Web：pending 卡片、井字棋棋盘
- Migration：`0008_ai_tictactoe_data`

### 当时未做（后续）

- SSE 真流式深化、云 `LLM_API_KEY`、M1/M2（见 [agent-capability-plans.md](./agent-capability-plans.md)）

---

## 验证快照（历史）

### 2026-07-03（3A+4A 波次）

- Server tests：68 pass；E2E 私聊 + AI 会话初覆盖
- Migrations：`0003`–`0005`

### 2026-07-07（3B+4B 波次）

- Server tests：109 pass；`CI=true pnpm e2e`：28 pass
- Migrations：`0006`–`0008`

（当前仓库数字已远高于此；以最新 `bun test` / E2E 为准。）

---

## 归档索引（同分目录过程文）

| 文件 | 原用途 |
|------|--------|
| [phase-3-kickoff.md](./phase-3-kickoff.md) | Phase 3 开工评审 |
| [phase-3-plan.md](./phase-3-plan.md) | 3A/3B 实施计划 |
| [phase-3-agent-master-plan.md](./phase-3-agent-master-plan.md) | 3A+Agent 总控任务树 |
| [phase-4a-plan.md](./phase-4a-plan.md) | 4A 实施计划 |
| [phase-3-4-next-plan.md](./phase-3-4-next-plan.md) | 3B+4B 并行任务单 |
| [phase-2-closeout.md](./phase-2-closeout.md) | Phase 2 收尾 |
| [phase-3b1-group-plan.md](./phase-3b1-group-plan.md) | 群能力完善草案 |

---

## 原文档替换说明

下列路径现为 **短 stub**，请改链到本文：

- `docs/phase-3-agent-closeout.md` → 本文件（3A / 4A / 4B 汇合节）
- `docs/phase-3b-4b-closeout.md` → 本文件（3B / 3B.1 / 3A.1 / 4B 扩展节）
