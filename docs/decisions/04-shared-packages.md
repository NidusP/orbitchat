# ADR 04：共享包策略（shared-types / shared-utils / ui）

- **状态**：Accepted
- **日期**：2026-06-14
- **阶段**：Phase 0

## 背景

多端（Web、Orbitchat-rn、未来桌面）+ 严格类型安全要求 API 契约、域模型、验证逻辑有单一来源。需定义 packages 职责边界，避免 monorepo 变成「大泥球」。

## 选项

1. **无共享包，各 app 复制类型**
   - 优点：零耦合
   - 缺点：契约必然漂移，违反项目核心要求

2. **单一 shared 包**
   - 优点：简单
   - 缺点：UI、纯类型、validators 混在一起，RN/Web 边界不清

3. **分层共享包（shared-types + shared-utils + ui）**
   - 优点：职责清晰、按需依赖、Flutter 可通过 OpenAPI 对齐 types 层
   - 缺点：需维护包边界规则

## 决策

采用 **三层共享包**：`shared-types`、`shared-utils`、`ui`（Web 专用）。

## 原因

| 包 | 消费者 | 内容 |
|----|--------|------|
| `@orbitchat/shared-types` | server, web, orbitchat-rn | API request/response、domain 模型、类型守卫 |
| `@orbitchat/shared-utils` | server, web, orbitchat-rn | 纯函数 validators、formatters（无 Node/DOM 依赖） |
| `@orbitchat/ui` | web only | React 组件，不进入 server/RN |

- **SSOT 原则**：任何跨端字段（User.id、Post.content）只定义一次于 `shared-types/src/domain/`。
- **Runtime 验证**：Zod schema 定义在 server；可从 schema 推断类型 export 到 shared-types，或 schema 放 shared-utils（若仅依赖 zod）。
- **Flutter 路径**：无法 import TS；通过 `@hono/zod-openapi` 生成 OpenAPI → `openapi-generator` 生成 Dart models，字段名与 shared-types 保持一致。

## 权衡

- `shared-types` 不得 import `react`、`hono` 等框架，保持平台无关。
- domain 类型与 DB entity 分离：DB 层可有额外字段（passwordHash），API DTO 在 shared-types 中显式定义。

## 后续

### shared-types 结构

```
packages/shared-types/src/
├── api/
│   ├── response.ts      # SuccessResponse, ErrorResponse ✅
│   ├── pagination.ts    # PaginatedResponse ✅
│   └── v1/              # 按 API 版本组织 request/response
│       └── users.ts
├── domain/
│   ├── user.ts
│   ├── post.ts
│   └── index.ts
├── utils/
│   └── guards.ts
└── index.ts
```

### 类型工作流（Spec 驱动）

1. 更新 `docs/api-spec.md` 描述端点
2. 在 `shared-types` 添加/修改类型
3. Hono route 使用 `@hono/zod-validator` + 相同 shape
4. Web/RN client 导入相同类型
5. PR 检查：类型变更必须同步 api-spec

### shared-utils 结构

```
packages/shared-utils/src/
├── validators/    # isValidEmail, isValidPassword ✅
├── formatters/
└── index.ts
```

- 仅纯函数，可单元测试，无 I/O

### ui 包

- Phase 2 起填充；设计 token 与 Web 一致
- RN 使用独立组件库（React Native Paper 等），通过 props 类型从 shared-types 导入数据 shape

## 相关

- [01-monorepo-strategy.md](./01-monorepo-strategy.md)
- [docs/api-spec.md](../api-spec.md)
- [docs/coding-rules.md](../coding-rules.md)
