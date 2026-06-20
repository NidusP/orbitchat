# ADR 07：ORM 选择（Drizzle ORM）

- **状态**：Accepted
- **日期**：2026-06-14
- **阶段**：Phase 1

## 背景

已选定 PostgreSQL（ADR 06）。需要 TypeScript-first 的数据访问层，与 Hono、shared-types 协作，并支持迁移与类型推断。

## 选项

1. **Prisma**
   - 优点：DX 极佳、Studio、生态大
   - 缺点：独立 schema DSL；Client 体积大；与部分 edge/runtime 场景耦合

2. **Drizzle ORM**
   - 优点：Schema 即 TS；SQL-like API；轻量；与 Zod 集成好；Bun/Node 均可用
   - 缺点：生态小于 Prisma；复杂关系需更多手写

3. **TypeORM**
   - 优点：装饰器模式、历史悠久
   - 缺点：类型推断弱于 Drizzle；维护活跃度一般

4. **Kysely（仅 query builder）**
   - 优点：类型安全 SQL
   - 缺点：无内置 migration 故事，需另配

## 决策

选择 **Drizzle ORM** + **drizzle-kit**（迁移）。

## 原因

- **Schema 即代码**：`pgTable` 定义与 TS 类型同源，便于 Agent 与 code review。
- **与 strict TS 一致**：推断 `Select` / `Insert` 类型，可映射到 `shared-types` 的 API DTO（DTO 与 DB entity 仍分层）。
- **现代全栈常见选型**：Hono + Drizzle + Postgres 社区案例多。
- **迁移**：`drizzle-kit generate` / `migrate`，SQL 文件可审查、可版本控制。
- **性能**：薄抽象，接近手写 SQL。

## 权衡

- API 层不直接暴露 Drizzle entity；Service 层映射为 `shared-types` DTO（避免泄漏 `passwordHash` 等）。
- 复杂查询（Feed 时间线）可能用 `sql` 模板或 raw query，仍放在 service 层。

## 后续

### 依赖（Phase 1）

```bash
# apps/server
drizzle-orm
drizzle-kit
postgres   # 或 pg — 按 Bun 兼容性选择 postgres.js
```

### 工作流

```
1. 修改 src/db/schema/*.ts
2. pnpm drizzle-kit generate
3. pnpm drizzle-kit migrate
4. 更新 docs/db-schema.md（与 schema 同步）
5. 更新 shared-types domain（若 API 字段变化）
```

### Schema 与文档关系

- **SSOT for DB structure**：`apps/server/src/db/schema/`（实现）
- **SSOT for API contract**：`packages/shared-types`
- **Human-readable 概览**：`docs/db-schema.md`（随迁移迭代，见该文档维护策略）

## 相关

- [06-database-choice.md](./06-database-choice.md)
- [docs/db-schema.md](../db-schema.md)
- [04-shared-packages.md](./04-shared-packages.md)
