# ADR 06：数据库选择（PostgreSQL）

- **状态**：Accepted
- **日期**：2026-06-14
- **阶段**：Phase 1

## 背景

Phase 1 需持久化用户、资料、会话（多端登录）等数据。需在关系型引擎中选型，要求与 TypeScript 全栈生态配合良好、支持本地开发与未来生产扩展。

## 选项

1. **SQLite**
   - 优点：零配置、Bun 内置、本地开发极简
   - 缺点：并发写入弱；多端 Session、社交 Feed 扩展后易触顶；生产多实例需额外方案

2. **PostgreSQL**
   - 优点：TS 全栈事实标准；JSONB、全文搜索、成熟托管（Neon/Supabase/RDS）；会话/关系/聊天模型天然适合
   - 缺点：本地需 Docker 或托管实例；比 SQLite 重

3. **MySQL**
   - 优点：普及、托管多
   - 缺点：与 Drizzle/现代 TS 教程生态略逊于 Postgres；JSON 能力较弱

## 决策

选择 **PostgreSQL 16+** 作为 Orbitchat 主数据库。

## 原因

- **TS 全栈最常见组合**：Next.js + Hono + Postgres + Drizzle 有大量参考实现与 Agent 训练数据。
- **Phase 1 会话模型**：`user_sessions` 多行 per user、索引、并发 revoke 适合 Postgres 行级锁。
- **后续功能**：JSONB（Post 媒体元数据）、全文搜索（用户搜索）、Phase 3 消息表高写入 — Postgres 足够支撑到 Phase 4+。
- **开发体验**：Docker Compose 本地 `postgres:16-alpine`；测试可用同一引擎或 Testcontainers。

## 权衡

- 本地需运行 Postgres（Docker 推荐）；不接受纯文件 DB 的零依赖。
- Phase 0 不引入 DB；Phase 1 第一步配置 `DATABASE_URL` 与迁移。

## 后续

### 连接字符串

```
DATABASE_URL=postgresql://orbitchat:orbitchat@localhost:5432/orbitchat
```

### 目录（Phase 1）

```
apps/server/
├── drizzle.config.ts
└── src/db/
    ├── index.ts      # drizzle client
    └── schema/       # Drizzle schema（见 ADR 07）
```

### 托管（生产，后续）

- 候选：Neon、Supabase Postgres、AWS RDS
- 要求：SSL、自动备份、连接池（PgBouncer 或 Neon built-in）

## 相关

- [07-orm-selection.md](./07-orm-selection.md)
- [08-auth-strategy.md](./08-auth-strategy.md)
- [docs/db-schema.md](../db-schema.md)
