# ADR 21：Agent 长期记忆模型（M1）

- **状态**：Accepted
- **日期**：2026-07-09
- **阶段**：Phase 4 — Orbit Guide Wave 2（M1）

## 背景

Orbit Guide（小轨）需要在**跨 AI 会话**中记住少量与用户相关的事实（称呼、偏好、稳定信息），以便新建会话时仍能「懂用户」。Phase 4A 仅有 `ai_conversations` / `ai_messages` 会话内上下文，关闭会话后无法延续。

M1 目标是：**可审计、可删除、显式写入** 的用户级记忆，为后续 RAG（M2）与摘要压缩（M3）留出清晰边界。详见 [phase-4-agent-memory-rag-plan.md](../phase-4-agent-memory-rag-plan.md) 与 [phase-4-orbit-guide-plan.md](../phase-4-orbit-guide-plan.md) § Wave 2。

## 选项

### 1. 塞进 `ai_conversations` JSON 或 `tictactoe_data` 类 blob

- 优点：无新表。
- 缺点：职责混乱；难以按用户列表/软删；与游戏状态、会话元数据耦合。

### 2. 独立表 `user_agent_memories`，静默从每轮对话自动抽取

- 优点：用户体验「自动记住一切」。
- 缺点：隐私与可控性差；抽取质量不可控；M1 范围膨胀。

### 3. 独立表 + 显式写入路径（API / Tool 经用户确认）

- 优点：职责清晰；用户可管理；与 4B 写工具审计模式一致。
- 缺点：需额外 UI 与 Tool 流程。

## 决策

选择 **选项 3**。

- 新增表 **`user_agent_memories`**，存储跨会话用户事实。
- **M1 禁止静默抽取**：不得从每条用户消息后台自动落库；仅允许：
  - 用户通过 `POST /api/v1/ai/memories` 手动添加；
  - 未来 `remember_fact` Tool 经用户 Approve 后写入（`source = 'tool'`）。
- **`agent_id` 可空**：`NULL` 表示该记忆对该用户所有 Agent 可见；非空则仅绑定特定 Agent。
- **软删**：`deleted_at`；列表与 prompt 注入均过滤已删记录。

### 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| user_id | UUID FK → users | 记忆所属用户 |
| agent_id | UUID FK → agents, nullable | 空 = 全 Agent 共享 |
| kind | enum | `preference` / `fact` / `nickname` |
| content | TEXT | 简短事实正文 |
| source | enum | `user_explicit` / `tool` / `admin` |
| conversation_id | UUID FK → ai_conversations, nullable | 来源会话，便于审计 |
| created_at / updated_at | TIMESTAMPTZ | |
| deleted_at | TIMESTAMPTZ, nullable | 软删 |

**索引**：`(user_id, deleted_at)` — 按用户拉取有效记忆。

## 原因

- **与用户信任对齐**：记忆必须可查看、可删除；静默抽取违背 Orbit Guide 产品原则。
- **与现有 AI 域分离**：会话消息（`ai_messages`）、游戏状态（`tictactoe_data`）、Tool 审计（`ai_tool_calls`）各司其职。
- **为 M2/M3 预留**：RAG 索引 `posts` / `docs`；会话摘要进 `ai_conversation_summaries`（M3）；通用记忆不进万能 JSON 列。

## 权衡

- 用户需主动添加或确认 Tool 提议，无法「无感全记住」。
- M1 不 dedupe 重复 content；后续可按 `(user_id, kind, content)` 去重或合并。

## 后续

1. Drizzle schema + migration `0014_user_agent_memories`
2. `shared-types`：`UserAgentMemory` 域类型与 REST 契约类型
3. Wave 2 实现：`memory-service`、`GET/POST/DELETE /api/v1/ai/memories`、prompt 注入（limit 8）
4. Tool `remember_fact`（pending → Approve）与设置页 UI

## 相关

- [phase-4-agent-memory-rag-plan.md](../phase-4-agent-memory-rag-plan.md)
- [phase-4-orbit-guide-plan.md](../phase-4-orbit-guide-plan.md)
- [ADR 17 — AI Agent 架构](./17-ai-agent-architecture.md)
- [db-schema.md](../db-schema.md) — `user_agent_memories`
