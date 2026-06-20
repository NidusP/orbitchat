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
- [ ] 10-api-versioning.md - API 版本管理
- [ ] 11-testing-framework.md - 测试框架选择

---

## 即将记录的决策

在项目进展中，以下决策会被记录：

| 决策 | 相关阶段 | 优先级 |
|-----|---------|--------|
| 数据库选择 | Phase 1 | P0 | ✅ ADR 06 PostgreSQL |
| ORM 框架 | Phase 1 | P0 | ✅ ADR 07 Drizzle |
| 认证方案 | Phase 1 | P0 | ✅ ADR 08 Session + 双 Token |
| 服务端目录 / API Client 生成 | Phase 1 后期 | P2 | 📋 ADR 09 Deferred |
| 错误追踪 | Phase 2 | P1 |
| 缓存策略 | Phase 3 | P2 |
| 消息队列 | Phase 3 | P2 |

