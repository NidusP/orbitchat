# ADR 02：后端运行时与框架（Bun + Hono）

- **状态**：Accepted
- **日期**：2026-06-14
- **阶段**：Phase 0

## 背景

Orbitchat 需要一套 TypeScript-first、轻量、支持 REST 与未来 WebSocket 的后端。API 须兼容 Web、移动端等多端请求，并具备端到端类型安全路径。

## 选项

1. **Node.js + Express**
   - 优点：生态最大、资料最多
   - 缺点：中间件风格陈旧、类型推断弱、选型过多易分散学习焦点

2. **Node.js + Fastify**
   - 优点：性能好、schema 验证内置
   - 缺点：与 Bun 生态结合不如 Hono 紧密

3. **Bun + Hono**
   - 优点：原生 TS、启动快、Hono 类型推断强、支持 RPC client、WebSocket、多运行时
   - 缺点：Bun 生产部署经验相对 Node 少（学习项目可接受）

4. **NestJS**
   - 优点：企业级结构、DI、模块化
   - 缺点：Phase 0 过重，与「渐进式复杂度」原则冲突

## 决策

选择 **Bun + Hono** 作为 Phase 0–3 的主 API 服务。

## 原因

- **Hono 类型系统**：路由链式定义 + `c.req.valid('json')`（配合 Zod）可实现 handler 级类型安全。
- **多端 API 一致**：Hono 暴露标准 HTTP/JSON；移动端、Web 均通过同一 REST + WebSocket 契约访问，无框架绑定。
- **可选 RPC 路径**：Phase 1+ 可评估 `@hono/zod-openapi` 或 Hono RPC（`hc<AppType>`）为 Web 端生成类型安全 client；移动端仍走 OpenAPI codegen。
- **WebSocket 原生支持**：Phase 3 聊天/音视频信令可同进程扩展，无需换框架。
- **Bun 开发体验**：`bun run --hot` 热重载、内置 test runner，降低 Phase 0 工具链成本。

## 权衡

- 生产环境若需 Node 兼容，Hono 可零改动迁移到 Node/Deno（保留选项）。
- 个人橱窗等重 IO 模块未来可能拆为 Go 微服务（见 product.md），Hono monolith 作为 API 网关聚合。

## 后续（Hono 生态最佳实践）

### 目录结构（Phase 1 前 scaffold）

```
apps/server/src/
├── index.ts           # 组装 app、挂载路由
├── env.ts             # 环境变量（类型安全，可用 hono/env 或 zod）
├── routes/            # 按域拆分 Hono 子应用
│   ├── index.ts       # route('/api/v1', v1Router)
│   └── v1/
│       ├── users.ts
│       └── auth.ts
├── middleware/        # auth、logger、error handler
├── services/          # 纯业务逻辑，不依赖 Context
└── lib/               # errors、db client 等
```

### 推荐依赖（Phase 1 起逐步引入）

| 包 | 用途 |
|----|------|
| `@hono/zod-validator` | 请求体验证，与 shared-types 对齐 |
| `zod` | runtime schema，可复用于 shared-utils |
| `@hono/zod-openapi` | OpenAPI spec 生成（多端 codegen） |
| `hono/jwt` 或 `jose` | JWT 认证 |

### 路由约定

- 基础设施：`GET /health`（无 envelope，供探针使用）
- 业务 API：统一前缀 `/api/v1/*`，响应使用 `SuccessResponse<T>` envelope（见 api-spec.md）
- 子路由：`app.route('/api/v1/users', usersRouter)` 保持模块化

### 错误处理

- 自定义 `AppError` + `app.onError` 全局捕获
- 404 使用 `app.notFound`，返回 `ErrorResponse` 格式

## 相关

- [docs/api-spec.md](../api-spec.md)
- [docs/coding-rules.md](../coding-rules.md) — Hono 后端规范
- [03-frontend-framework.md](./03-frontend-framework.md)
