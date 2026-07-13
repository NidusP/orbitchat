# ADR 22：Agent RAG 边界与索引策略（M2）

- **状态**：Accepted
- **日期**：2026-07-09
- **阶段**：Phase 4 — Orbit Guide Wave 3（M2 基础设施）

## 背景

Orbit Guide Wave 2（M1）已交付跨会话显式记忆（`user_agent_memories`）。Wave 3 需要让 Agent 能基于**用户有权访问的站内内容**做语义检索（RAG），回答「我有没有发过关于旅行的帖」类问题。

需在引入向量索引前明确：**哪些 collection 可索引、权限如何隔离、embedding 从哪来、何时重建**。详见 [phase-4-orbit-guide-plan.md](../phase-4-orbit-guide-plan.md) § Wave 3 与 [phase-4-agent-memory-rag-plan.md](../phase-4-agent-memory-rag-plan.md) § M2。

## 选项

### 1. 索引一切可搜文本（帖子 + DM + AI 会话）

- 优点：检索覆盖面最大。
- 缺点：隐私风险高；DM / 私聊无公开边界；与 M1「显式记忆」职责重叠。

### 2. 仅本人帖子 + 公开帮助文档（v1）

- 优点：权限清晰；与现有社交模型一致；学习成本低。
- 缺点：不能语义搜他人帖子、Feed 片段或私信。

### 3. 独立向量库（Redis / Qdrant）

- 优点：专用 ANN 性能更好。
- 缺点：多一套运维；与 Postgres 事务不同步。

## 决策

选择 **选项 2**（collection 边界）+ **Postgres pgvector**（存储，见 [phase-4-orbit-guide-plan.md](../phase-4-orbit-guide-plan.md) § 7.1）。

### Collection 边界（v1）

| `source_type` | 范围 | `owner_user_id` | 可见性 |
|---------------|------|-----------------|--------|
| `post` | 用户自己发布的帖子正文 | 发帖用户 UUID | 仅本人可检索（`owner_user_id = 当前用户`） |
| `doc` | `docs/` 静态帮助 / 产品说明 MD | `NULL` | 全员可读（公开） |

**v1 明确不做**：

- 私信 / DM（`messages`）
- 他人帖子、未授权 Feed 内容
- `ai_messages` 会话全文向量索引（留给 M3 摘要或远期 ADR）

### Embedding 提供方

- 调用与聊天相同的 **OpenAI-compatible** 端点：`POST {LLM_BASE_URL}/embeddings`
- 模型与维度由 env 配置：`EMBEDDING_MODEL`（默认 `nomic-embed-text`）、`EMBEDDING_DIMENSIONS`（默认 `768`）
- 本地开发推荐 Ollama：`ollama pull nomic-embed-text`

### 索引与重建（MVP）

- **同步 on-write**：帖子 `INSERT` / `UPDATE` 时立即切块（整帖一条 chunk MVP）并 upsert `knowledge_chunks`
- 唯一键 `(source_type, source_id)` 支持幂等 upsert
- 帮助文档：部署或启动时批量索引；**`content_hash` 未变则跳过 embed**（向量仍存 Postgres）
- 帖子软删：后续 wave 在 `post-service` 删除 chunk；本 ADR 仅定边界

### 检索路径

- **走 Tool**，非每次请求全库扫描：`search_my_posts`、`search_help_docs`（Wave 3 实现）
- Orchestrator 将 Top-K chunk 作为 tool result 注入，UI 展示出处（`postId` / 文档标题）

### E2E / 测试

- `LLM_E2E_MOCK=true` 时，embedding 使用 **确定性 hash 向量**（`HashMockEmbeddingProvider`），不依赖 Ollama embedding 模型
- `RAG_ENABLED=false` 可关闭索引与检索（运维开关）

## 原因

- **权限最小化**：只索引用户明确拥有的帖子与公开文档，避免 RAG 泄露私信。
- **栈一致**：pgvector 与 Drizzle/Postgres 同事务域，upsert 与帖子写入可同路径（MVP 同步）。
- **与 M1 分工**：M1 = 用户显式事实；M2 = 可引用出处的知识片段；不混用 `user_agent_memories` 存帖子正文。

## 权衡

- 同步 embedding 增加帖子写入延迟；帖量大后需改异步 job（保留同表 upsert 契约）。
- 768 维固定列；换模型需新 migration 或重建索引。
- v1 不做跨用户帖子语义搜。

## 后续

1. Migration `0015_knowledge_chunks` + Drizzle schema
2. `embedding-provider.ts` + env（`EMBEDDING_*`, `RAG_ENABLED`）
3. `docker-compose.yml` → `pgvector/pgvector:pg16`
4. `rag-service` + post 写入钩子 + Tool（Wave 3 应用层）
5. `docs/db-schema.md` 同步

## 相关

- [phase-4-orbit-guide-plan.md](../phase-4-orbit-guide-plan.md)
- [phase-4-agent-memory-rag-plan.md](../phase-4-agent-memory-rag-plan.md)
- [ADR 21 — Agent 长期记忆](./21-agent-memory-model.md)
- [ADR 17 — AI Agent 架构](./17-ai-agent-architecture.md)
- [db-schema.md](../db-schema.md) — `knowledge_chunks`
