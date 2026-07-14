# Agent 能力规划（归档）

> **状态**：历史过程文档 · Wave 0–5 / M1–M3 已落地（2026-07-09）  
> **说明**：由原 `phase-4-orbit-guide-plan` 与 `phase-4-agent-memory-rag-plan` **按阶段合并索引**；实现细节以活文档与完整原文为准。  
> **活文档**：[orbit-guide-agent-implementation.md](../orbit-guide-agent-implementation.md)、[ADR 17](../decisions/17-ai-agent-architecture.md)、[21](../decisions/21-agent-memory-model.md)、[22](../decisions/22-agent-rag-boundaries.md)  
> **当前产品迭代**：[phase-indie-product-plan.md](../phase-indie-product-plan.md)

完整原文（未删减）仍在本目录：

| 原文 | 侧重 |
|------|------|
| [phase-4-orbit-guide-plan.md](./phase-4-orbit-guide-plan.md) | 小轨产品路线 · **Wave 0–5** |
| [phase-4-agent-memory-rag-plan.md](./phase-4-agent-memory-rag-plan.md) | Memory / RAG / Fine-tune · **M1–M3** |

---

## 阶段对应关系

```text
Wave 0  交付债（合入基线）
Wave 1  平台感知（只读 Tool）     ← 非 M 轨
Wave 2  长期记忆                  ≡ M1
Wave 3  站内 RAG                  ≡ M2
Wave 4  长聊摘要                  ≡ M3
Wave 5  体验与可信（polish）
────────────────────────────────
远期    Fine-tuning               （决策：默认不做）
```

> roadmap 中的 **Phase 4C = WebRTC**，与本文 **M1/M2/M3** 并行编号，互不占用。

---

## Wave 0 — 交付债

**目标**：后续迭代站在干净 master 上（migrate、test、SSE 基线）。

**状态**：✅ 已完成（随 3B+4B / SSE 等合入）。

详见原文 [phase-4-orbit-guide-plan.md §4](./phase-4-orbit-guide-plan.md)。

---

## Wave 1 — 平台感知

**目标**：不引入向量库；小轨能查站内已有数据。

| 交付 | 说明 |
|------|------|
| 只读 Tool | `get_my_profile`、`list_my_recent_posts`、`get_user_profile`、`list_user_recent_posts` |
| Prompt | 身份边界 + 当前用户轻量上下文 |

**状态**：✅ 2026-07-09

详见原文 §5。

---

## Wave 2 ≡ M1 — 长期记忆

**目标**：跨 AI 会话记住用户级少量、可审计、可删除事实。

| 交付 | 说明 |
|------|------|
| 表 | `user_agent_memories`（migration `0014`） |
| API | `GET/POST/DELETE /api/v1/ai/memories` |
| Tool | `remember_fact`（pending → Approve） |
| 注入 | 会话前 Top-K 记忆拼入 system |
| UI | `/ai/memories` |

**状态**：✅ 2026-07-09 · ADR [21](../decisions/21-agent-memory-model.md)

详述：[orbit §6](./phase-4-orbit-guide-plan.md) · [memory § M1](./phase-4-agent-memory-rag-plan.md#m1--长期记忆-mvp)

---

## Wave 3 ≡ M2 — 站内 RAG

**目标**：基于用户有权访问的内容做语义检索。

| 交付 | 说明 |
|------|------|
| 表 / 栈 | `knowledge_chunks` + pgvector（`0015`） |
| Tool | `search_my_posts`、`search_help_docs` |
| Env | `RAG_ENABLED`、`EMBEDDING_*` |

**状态**：✅ 2026-07-09（原文 memory 计划头曾写「进行中」，落地后以 Wave 3 状态表为准）· ADR [22](../decisions/22-agent-rag-boundaries.md)

详述：[orbit §7](./phase-4-orbit-guide-plan.md) · [memory § M2](./phase-4-agent-memory-rag-plan.md#m2--rag站内内容--进行中)

---

## Wave 4 ≡ M3 — 长聊摘要

**目标**：超长单会话压缩早期内容，与最近消息一并注入。

| 交付 | 说明 |
|------|------|
| 表 | `ai_conversation_summaries`（`0016`） |
| 触发 | 约 >30 条消息刷新摘要 |

**状态**：✅ 2026-07-09

详述：[orbit §8](./phase-4-orbit-guide-plan.md) · [memory § M3](./phase-4-agent-memory-rag-plan.md#m3--会话摘要长对话)

---

## Wave 5 — 体验与可信

**目标**：记忆 UI、引用卡片、友好错误、分场景 prompt 等 polish。

**状态**：✅ MVP（2026-07-09）；「建议记忆」主动提议 UI 仍为远期。

详见原文 §9。

---

## 决策速查：Memory vs RAG vs Fine-tuning

| 想解决的问题 | 首选 | 对应阶段 |
|--------------|------|----------|
| 跨会话记住称呼/偏好 | 长期记忆 | Wave 2 / M1 |
| 根据帖子/帮助文档回答 | RAG | Wave 3 / M2 |
| 百轮对话不丢早期要点 | 会话摘要 | Wave 4 / M3 |
| 改模型权重 | Fine-tuning | **默认不做** |

注入顺序（概念）：

```text
systemPrompt → [记忆 M1] → [摘要 M3] → 近期消息 → 用户消息
RAG 走 Tool，避免每次全库扫描
```

完整决策矩阵与表结构草案见 [phase-4-agent-memory-rag-plan.md](./phase-4-agent-memory-rag-plan.md)。

---

## 非目标（全阶段）

- Per-user 微调；隐式无同意记忆；Agent 改 `system_prompt`
- 无 Approve 的写操作；用 RAG 读他人私信
- LangChain / LangGraph（除非编排复杂度逼迫再评估）

---

## 原路径 stub

- `docs/phase-4-orbit-guide-plan.md` → 本文（Wave）+ [原文](./phase-4-orbit-guide-plan.md)
- `docs/phase-4-agent-memory-rag-plan.md` → 本文（M*）+ [原文](./phase-4-agent-memory-rag-plan.md)
