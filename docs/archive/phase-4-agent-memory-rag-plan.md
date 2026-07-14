# Agent 记忆、RAG 与 Fine-tuning 决策与实施计划

> **状态**：M1 已交付（2026-07-09）；**M2 进行中**（Wave 3）  
> **小轨实施路线（Wave 0–5）**：[phase-4-orbit-guide-plan.md](./phase-4-orbit-guide-plan.md)  
> **合并索引**：[agent-capability-plans.md](./agent-capability-plans.md)  
> **前置**：Phase 4A AI Chat、4B Tool、`play_tictactoe` 对局持久化（`ai_conversations.tictactoe_data`）  
> **关联 ADR**：[17-ai-agent-architecture.md](../decisions/17-ai-agent-architecture.md)、[22-agent-rag-boundaries.md](../decisions/22-agent-rag-boundaries.md)（M2）  
> **命名说明**：roadmap 中 **Phase 4C = WebRTC / 多媒体**；本文 **M1/M2/M3** 指 Agent 智能扩展轨，可与 4B 扩展并行，不占用 4C 编号。

本文档供**以后实现**时查阅：在 Orbitchat 现有 Agent 架构上，何时用 **会话上下文 / 长期记忆 / RAG / fine-tuning**，以及推荐落地顺序与最小表结构草案。

---

## 1. 现状（截至 Phase 4B）

| 能力 | 存储 / 机制 | 局限 |
|------|-------------|------|
| 单会话短期记忆 | `ai_messages`，运行时取最近 **20** 条 `user`/`assistant`（不含 `tool`） | 超长对话会丢早期上下文 |
| Agent 人设 | `agents.system_prompt`，全局固定 | 不会随用户自动调整 |
| 井字棋状态 | `ai_conversations.tictactoe_data`（`active` + `history`） | 仅游戏，非通用用户理解 |
| 工具与审计 | `ai_tool_calls` + `tool-executor` | 有「做了什么」，无「用户是谁」的长期画像 |
| 跨会话记忆 | ❌ | 新开 AI chat ≈ 陌生人 |
| 知识库 RAG | ❌ | 不能基于文档/帖子语义检索 |
| Fine-tuning | ❌ | 未计划训练自有模型 |

**结论**：小轨「更懂用户」目前只能靠**同一会话内**的对话 + **井字棋结构化历史**；这不是模型进化，是**上下文注入**。

---

## 2. 三种手段是什么（一句话）

| 手段 | 改什么 | 典型问题 |
|------|--------|----------|
| **长期记忆（Memory）** | 把关于**用户/会话**的事实写入 DB，按需检索后塞进 prompt | 「他上次说讨厌太长回复」「常和 @luna 聊天」 |
| **RAG** | 从**外部知识库**（文档、帖子、FAQ）向量检索片段，塞进 prompt | 「根据产品手册回答」「在我发的帖子里找相关内容」 |
| **Fine-tuning** | 用自有数据**再训练模型权重**，得到新模型版本 | 「输出格式永远稳定」「行业术语极深」 |

三者可组合，但**职责不同**：

```text
用户消息
  → [可选] 检索长期记忆（关于这个 user）
  → [可选] RAG 检索（关于知识库 / 帖子 / 文档）
  → 会话近期消息（ai_messages）
  → 固定 systemPrompt + Tool 定义
  → LLM → Tool loop → 回复
```

Fine-tuning **不参与**上述单次请求链路；它改变的是**底层模型默认行为**。

---

## 3. 决策矩阵（什么时候用哪种）

### 3.1 按需求选

| 你想解决的问题 | 首选 | 次选 | 通常不需要 |
|----------------|------|------|------------|
| 用户说「叫我小明」「我偏好简短回复」 | 长期记忆 | 会话内上下文 | Fine-tuning |
| 跨多次 AI 会话记住偏好 | 长期记忆 | 会话摘要表 | Fine-tuning |
| 根据站内帖子/帮助文档回答问题 | RAG | — | Fine-tuning |
| 搜索「我三个月前聊过什么」 | RAG（对 `ai_messages` 做 embedding） | 长期记忆摘要 | Fine-tuning |
| 工具调用 JSON 格式老出错 | 更好 FC schema + 示例 prompt | 少量 fine-tune | RAG |
| 全站统一品牌话术、医疗/legal 固定模板 | Fine-tuning（或规则后处理） | 强 system prompt | — |
| 井字棋「记得上次谁赢」 | 结构化状态（**已实现**） | 长期记忆 | RAG |

### 3.2 按 Orbitchat 学习项目优先级

| 优先级 | 能力 | 理由 |
|--------|------|------|
| **P0（M1）** | 长期记忆（显式 + 摘要） | 直接回应「更懂用户」；表结构简单；与现有 `conversation-service` 易集成 |
| **P1（M2）** | RAG（帖子 + 可选帮助文档） | 与社交核心（Feed/posts）结合，学习价值高 |
| **P2（M3）** | 会话摘要压缩 | 解决 20 条窗口限制，为长聊铺路 |
| **P3（远期 / 可能不做）** | Fine-tuning | 成本高、合规重；学习 ROI 低于 RAG + Memory |

### 3.3 企业实践对照（为何我们不先做 fine-tune）

企业 Agent 主流栈：**基础模型 + Prompt + RAG + Tools + 编排 + 审计**（与 ADR 17 一致）。

Fine-tuning 在企业里多用于：**格式稳定、领域术语、降本用小模型**——且往往仍叠加 RAG 与工具。  
「让每个用户越聊越懂」**几乎从不**靠 per-user fine-tuning，而是 **记忆检索 + 业务数据**。

---

## 4. 推荐实施顺序（分阶段）

### M1 — 长期记忆 MVP

**目标**：跨 AI 会话记住**用户级**少量事实；用户可查看 / 删除。

| # | 任务 | 产出 |
|---|------|------|
| 1 | ADR 21（Agent 记忆模型） | `docs/decisions/21-agent-memory-model.md` |
| 2 | `db-schema` + migration | `user_agent_memories` 表 |
| 3 | `shared-types` + `api-spec` | `GET/POST/DELETE /api/v1/ai/memories` |
| 4 | `memory-service` | 写入、列表、按 `userId` 检索 |
| 5 | 注入 orchestrator | `createAiMessageAndRun` 前加载 Top-K 记忆拼入 system 或独立 `memory` 段 |
| 6 | （可选）Tool `remember_fact` | 用户说「记住我喜欢简短回复」→ LLM 调 tool → 落库（需确认或自动） |
| 7 | Web 设置页 | 「AI 记住的内容」列表与删除 |

**验收**：

- 会话 A 说「以后叫我 Orbit」；新建会话 B，小轨仍能用正确称呼。
- 用户可删除某条记忆，之后不再被注入。

**非目标（M1 不做）**：

- 向量检索全量聊天历史
- 自动从每句话抽取记忆（可 M1.1 做「建议记忆」+ 用户确认）

---

### M2 — RAG（站内内容）🚧 进行中

**目标**：Agent 能基于**用户有权访问的内容**回答（自己的帖子、公开 Feed 片段、静态帮助文档）。

| # | 任务 | 产出 |
|---|------|------|
| 1 | ADR 22（RAG 边界与权限） | 哪些 collection、embedding 模型、隔离规则 — 见 [22-agent-rag-boundaries.md](../decisions/22-agent-rag-boundaries.md) |
| 2 | 基础设施 | Postgres `pgvector` 或 Redis + 向量库；`embedding` 服务 env |
| 3 | 索引管道 | 帖子创建/更新时异步 embedding；或定时 job |
| 4 | `rag-service` | `search_knowledge(query, userId)` → chunks |
| 5 | Tool `search_posts` / `search_help` | 只读，立即执行 |
| 6 | orchestrator 注入 | 检索结果作为 tool 或 system 附录 |

**验收**：

- 用户问「我上周发过什么关于旅行的帖」→ 检索到相关 post 摘要并回答（需有测试数据）。
- 不能检索到无权限的私信 / 他人私密内容。

---

### M3 — 会话摘要（长对话）

**目标**：超过 N 轮后，将早期对话压缩为 `ai_conversation_summaries`，与最近 20 条一起注入。

| # | 任务 | 产出 |
|---|------|------|
| 1 | 表 `ai_conversation_summaries` | `conversation_id`, `summary`, `up_to_message_id` |
| 2 | 触发策略 | 每 30 条消息或 token 超阈值触发一次 LLM 摘要 |
| 3 | `loadRuntimeHistory` 改造 | `summary + recent messages` |

**验收**：100 轮对话后，Agent 仍能答对会话早期提到的关键事实（在摘要覆盖范围内）。

---

### 远期 — Fine-tuning（可选专题）

**仅当**以下至少一条成立时再立项：

- 本地小模型在 **tool JSON / 固定输出格式** 上反复失败，prompt 与 schema 优化仍不够；
- 需要 **离线评测集** 与版本化模型（学习训练流程本身）；
- 有明确 **脱敏后的高质量对话标注集**（≥ 数百～数千条）。

**建议做法**（若做）：

- 微调目标限定为：**工具调用格式** 或 **摘要质量**，而非「用户人格」。
- 仍保留 RAG + Memory + Tools；微调模型作为 `LLM_MODEL` 的可选版本。
- 单独文档：`docs/phase-5-finetune-playbook.md`（数据、评测、上线回滚）。

---

## 5. 最小表结构草案（实现时再细化）

### 5.1 `user_agent_memories`（M1）

```text
id              UUID PK
user_id         UUID FK → users
agent_id        UUID FK → agents (nullable = 所有 Agent 共享)
kind            VARCHAR   -- 'preference' | 'fact' | 'nickname' ...
content         TEXT      -- 「用户偏好简短回复」
source          VARCHAR   -- 'user_explicit' | 'tool' | 'admin'
conversation_id UUID nullable  -- 来源会话，便于审计
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
deleted_at      TIMESTAMPTZ nullable  -- 软删
```

索引：`(user_id, deleted_at)`。

### 5.2 `knowledge_chunks` + `embeddings`（M2，示意）

```text
knowledge_chunks
  id, source_type ('post'|'doc'), source_id, text, owner_user_id, visibility, created_at

-- embedding 可同表 vector 列或独立表，依 pgvector 选型而定
```

### 5.3 与现有表关系

```text
users
  └── user_agent_memories          ← 跨会话「懂用户」
  └── ai_conversations
        ├── ai_messages            ← 聊天正文（RAG 可索引）
        ├── tictactoe_data         ← 游戏专用（已有）
        └── ai_conversation_summaries  ← 长聊压缩（M3）
```

**不要**把通用记忆塞进 `tictactoe_data` 或 `ai_conversations` 任意 JSON 字段——职责分离，避免一列万能 blob。

---

## 6. 注入 prompt 的推荐方式（实现参考）

与当前 `AgentOrchestrator.buildMessages` 对齐：

```typescript
// 伪代码 — 未来在 conversation-service / orchestrator 扩展
[
  { role: 'system', content: agent.systemPrompt },
  { role: 'system', content: formatMemoryBlock(memories) },      // M1
  { role: 'system', content: formatSummaryBlock(summary) },      // M3
  ...history,  // 现有 ai_messages 最近 20 条
  { role: 'user', content: userMessage },
]
// RAG 更宜走 Tool：search_posts → tool result，避免每次请求全库检索
```

**原则**：

- 记忆条数 **Top-K（如 5～10）**，每条一两句话，控制 token。
- 记忆内容 **可审计、可删除**（GDPR / 用户信任）。
- RAG 片段 **带出处**（post id、标题），便于 UI 展示「依据」。
- **不**把整库 embedding 每次塞进 prompt。

---

## 7. Fine-tuning 专题速查（以后若做）

| 问题 | 说明 |
|------|------|
| 训练什么 | 通常是「输入 → 理想 tool call / 理想摘要」，不是整段闲聊 |
| 数据从哪来 | 脱敏 `ai_messages` + `ai_tool_calls` 成功样本；需人工抽检 |
| 和 Memory 区别 | Memory 是**事实库**；fine-tune 是**改模型习惯** |
| 和 RAG 区别 | RAG 知识更新了只重建索引；fine-tune 要重新训练 |
| 上线 | 新 `LLM_MODEL` 环境变量；A/B 对比 tool 成功率与幻觉率 |
| 学习项目建议 | **整库最后做**；先把 Memory + RAG 跑通 |

---

## 8. 非目标（全阶段）

- Per-user 独立微调模型
- 未经用户同意的隐式记忆（初期必须显式或「建议记忆 + 确认」）
- Agent 自动修改 `agents.system_prompt`
- 用 fine-tuning 替代写操作 Tool 的权限与审计

---

## 9. 验收清单（M1 完成时）

- [ ] 用户跨会话偏好可被记住并正确使用
- [ ] 用户可查看、删除记忆
- [ ] `api-spec.md` / `db-schema.md` / ADR 18 已同步
- [ ] 记忆注入不破坏现有 Tool loop 与 `send_dm` 审批流
- [ ] 单元测试：`memory-service`；集成测试：orchestrator 注入

---

## 10. 相关文档

- [decisions/17-ai-agent-architecture.md](../decisions/17-ai-agent-architecture.md) — Runtime 边界与 Tool 原则
- [phase-4a-plan.md](./phase-4a-plan.md) — 4A 范围
- [roadmap.md](../roadmap.md) — Phase 4C = WebRTC（与本文 M 轨并行）
- [db-schema.md](../db-schema.md) — `ai_conversations`、`ai_messages`
- [api-spec.md](../api-spec.md) — `/api/v1/ai/*`

---

**最后更新**：2026-07-07（规划稿，启动 M1 时拆 ADR 18 + 任务表）
