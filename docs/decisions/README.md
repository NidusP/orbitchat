# 架构决策记录

本目录记录了 Orbitchat 项目的重要架构决策及其原因。

## 为什么使用决策记录？

- **可追溯性** - 理解每项决策的背景和原因
- **知识保留** - 为未来的维护者记录上下文
- **避免重复讨论** - 已做决定不需反复论证

---

## 决策记录模板

每个重要决策使用以下格式记录：

```markdown
# 决策 X：[简短标题]

## 背景
[为什么需要做这个决策？]

## 选项
1. [选项A] - 优缺点
2. [选项B] - 优缺点
3. [选项C] - 优缺点

## 决策
选择选项 X

## 原因
[详细的决策原因]

## 权衡
[需要接受的代价]

## 后续
[如何在项目中落实]

## 相关讨论
[链接或参考信息]
```

---

## 已做决策清单

### 已完成（Phase 0）

- [x] [01-monorepo-strategy.md](./01-monorepo-strategy.md) - Monorepo vs 多仓库
- [x] [02-backend-framework.md](./02-backend-framework.md) - 为什么选择 Bun + Hono
- [x] [03-frontend-framework.md](./03-frontend-framework.md) - 为什么选择 Next.js
- [x] [04-shared-packages.md](./04-shared-packages.md) - 共享包策略
- [x] [05-doc-first.md](./05-doc-first.md) - 文档驱动与 Harness Engineering

### 待做（后续阶段）

- [x] [06-database-choice.md](./06-database-choice.md) - PostgreSQL
- [x] [07-orm-selection.md](./07-orm-selection.md) - Drizzle ORM
- [x] [08-auth-strategy.md](./08-auth-strategy.md) - 多端认证与会话
- [ ] [09-server-layout-and-api-codegen.md](./09-server-layout-and-api-codegen.md) - 服务端目录与 API Client 生成（**Deferred**，Phase 1 后期评审）

### Phase 2（社交）

- [x] [10-social-content-storage.md](./10-social-content-storage.md) - 社交内容存储模型
- [x] [11-feed-timeline-strategy.md](./11-feed-timeline-strategy.md) - Feed 时间线策略
- [x] [12-phase2-client-sync.md](./12-phase2-client-sync.md) - Phase 2 客户端同步（REST + 轮询）

### Phase 3（消息与实时）

- [x] [13-websocket-stack.md](./13-websocket-stack.md) - WebSocket 栈与部署边界
- [x] [14-message-delivery.md](./14-message-delivery.md) - 消息写入与投递模型
- [x] [15-conversation-model.md](./15-conversation-model.md) - 1:1 会话与消息模型
- [x] [16-group-chat-model.md](./16-group-chat-model.md) - 群聊模型（`conversations.type = group`）

### Phase 4A（AI Chat MVP）

- [x] [17-ai-agent-architecture.md](./17-ai-agent-architecture.md) - 本地模型 Agent 架构、Runtime 边界与 Tool 权限
- [x] [18-api-robustness.md](./18-api-robustness.md) - API 接口健壮性原则与验收清单
- [x] [19-concurrency-optimistic-pessimistic.md](./19-concurrency-optimistic-pessimistic.md) - 协作编辑乐观锁 vs 库存悲观锁
- [x] [20-ai-sse-streaming.md](./20-ai-sse-streaming.md) - AI SSE 流式优化（连接反馈、真 token 流、Tool 进度）
- [x] [21-agent-memory-model.md](./21-agent-memory-model.md) - Agent 长期记忆 M1（`user_agent_memories`、显式写入）
- [x] [22-agent-rag-boundaries.md](./22-agent-rag-boundaries.md) - Agent RAG 边界 M2（`knowledge_chunks`、pgvector）

**原则总览**（非 ADR，与多条 ADR 交叉引用）：[architecture-principles.md](../architecture-principles.md)

### 待做（后续阶段）

- [ ] api-versioning.md - API 版本管理（编号待定）
- [ ] testing-framework.md - 测试框架选择（编号待定）

---

## 即将记录的决策

在项目进展中，以下决策会被记录：

| 决策 | 相关阶段 | 优先级 |
|-----|---------|--------|
| 数据库选择 | Phase 1 | P0 | ✅ ADR 06 PostgreSQL |
| ORM 框架 | Phase 1 | P0 | ✅ ADR 07 Drizzle |
| 认证方案 | Phase 1 | P0 | ✅ ADR 08 Session + 双 Token |
| 服务端目录 / API Client 生成 | Phase 1 后期 | P2 | 📋 ADR 09 Deferred |
| **社交内容存储** | Phase 2 | P0 | ✅ ADR 10 Postgres 四表 |
| **Feed 时间线** | Phase 2 | P0 | ✅ ADR 11 读扇出 + 时间倒序 |
| **Phase 2 客户端同步** | Phase 2 | P0 | ✅ ADR 12 REST + 轮询 |
| **WebSocket 栈** | Phase 3A | P0 | ✅ ADR 13 |
| **消息投递模型** | Phase 3A | P0 | ✅ ADR 14 |
| **1:1 会话模型** | Phase 3A | P0 | ✅ ADR 15 |
| **群聊模型与权限** | Phase 3B | P1 | 📋 ADR 16（可选） |
| **AI Agent 架构** | Phase 4A | P1 | ✅ ADR 17 |
| 错误追踪 | Phase 4+ | P2 |
| 缓存策略 | Phase 3+ | P2 |
| 消息队列 | Phase 4B+ | P2 |

