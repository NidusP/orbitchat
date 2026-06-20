# ADR 01：Monorepo 策略（pnpm workspace）

- **状态**：Accepted
- **日期**：2026-06-14
- **阶段**：Phase 0

## 背景

Orbitchat 是 Next.js（Web）+ Hono（API）的全栈项目，未来还将增加 Orbitchat-rn（或 Flutter）移动端。前后端及多端客户端需要共享 API 契约、验证逻辑和部分 UI 类型。需要在「单仓库 vs 多仓库」之间做出选择。

## 选项

1. **多仓库（Polyrepo）**
   - 优点：各端独立发布、权限隔离清晰
   - 缺点：类型同步靠 npm 发包或手工复制，多端契约易漂移

2. **pnpm workspace Monorepo**
   - 优点：共享包本地引用、类型即时同步、统一 lint/format、AI Agent 可看到完整系统
   - 缺点：仓库体积增长、需规范包边界

3. **Nx / Turborepo 增强 Monorepo**
   - 优点：任务编排、缓存、依赖图可视化
   - 缺点：Phase 0 引入额外复杂度，学习曲线陡

## 决策

选择 **pnpm workspace Monorepo**，Phase 0 不引入 Nx/Turborepo。

## 原因

- **类型安全是核心要求**：`@orbitchat/shared-types` 作为单一事实来源（Single Source of Truth），Web、Server、未来 RN 均从此导入，避免契约分叉。
- **pnpm 生态成熟**：content-addressable store、严格依赖隔离、与 TypeScript project references 配合良好。
- **Agentic Engineering 友好**：Agent 在一个 workspace 内即可理解 apps + packages 全貌，减少跨仓库上下文切换。
- **渐进式复杂度**：Phase 0 用 `pnpm -r` 脚本即可；待 CI 变慢再评估 Turborepo。

## 权衡

- 需明确 `apps/`（可运行应用）与 `packages/`（可复用库）边界，防止 packages 反向依赖 apps。
- 移动端若选 Flutter，无法直接复用 TS 类型，需通过 OpenAPI codegen 桥接（见 ADR 04、api-spec）。

## 后续

```
orbitchat/
├── apps/
│   ├── server/     # Bun + Hono API
│   └── web/        # Next.js
├── packages/
│   ├── shared-types/   # API + domain 类型（SSOT）
│   ├── shared-utils/   # 纯函数工具、validators
│   └── ui/             # Web 组件库（预留，RN 不复用）
└── pnpm-workspace.yaml
```

- 包命名：`@orbitchat/<name>`
- 依赖方向：`apps → packages`，packages 之间仅允许 `shared-utils → shared-types`
- 根脚本：`pnpm dev` / `pnpm build` / `pnpm lint` 递归执行

## 相关

- [04-shared-packages.md](./04-shared-packages.md)
- [docs/architecture.md](../architecture.md)
