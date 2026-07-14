# Zod 3 → 4 升级方案

> **日期**：2026-07-14  
> **分支**：`feat/indie-p1-p2`（与 P1/P2 WIP 同分支，勿另开）  
> **官方**：https://zod.dev/v4/changelog

## 目标

将 `@orbitchat/server` 的 `zod` 从 `^3.25.0` 升到 `^4.0.0`，修复 breaking API，门禁与升级前一致。

## 范围

| 在 | 不在 |
|----|------|
| `apps/server` 依赖与全部 Zod schema / env / validation | ESLint 10 |
| `@hono/zod-validator` 保持 `^0.7`（已 peer 支持 Zod 4）或可升 `^0.8`（同支持 Zod 4） | Web 客户端（未直接依赖 zod） |
| 单测适配（若 issue code / 错误格式变了） | 大规模 rewrite schema 风格 |

## 已知 breaking（对本仓库相关）

1. **`required_error` / `invalid_type_error` 已删除** → 改用 `error`（见 `schemas/auth.ts`）
2. **`message` 参数仍可用但 deprecated** → 可先保留，或改为 `error` 字符串/函数
3. **`ZodError.errors` 已删** → 只用 `.issues`（查 `validation.ts`）
4. **`z.ZodIssueCode`** — 确认 Zod 4 导出；`env.ts` superRefine 若报错，改为文档推荐的 issue `code`/`message` 写法
5. **`z.string().datetime()`** — 行为可能更严格；核对 conversations schema
6. **`.refine` / `.superRefine` 的 `{ message, path }`** — 多数仍可用，失败时对照 changelog

可选：社区 codemod `zod-v3-to-v4`；若效果差则手改。

## 执行步骤

1. `pnpm --filter @orbitchat/server add zod@^4.0.0`
2.（可选）`@hono/zod-validator@^0.8.0` — peer 同支持 zod 4；升了就跑通，不升也行  
3. 修编译错误：优先 `auth.ts`、`env.ts`、`validation.ts`、schemas  
4. `pnpm --filter @orbitchat/server type-check`  
5. `cd apps/server && bun test`  
6. 在 `docs/decisions/02-backend-framework.md` 推荐依赖表注明 **Zod 4**

## 验收标准

- [x] `package.json` / lockfile：`zod` 解析为 4.x（`zod@4.4.3`）
- [x] server `type-check` 通过
- [x] `bun test` 全绿（263 pass / 0 fail under `apps/server`）
- [x] `required_error` / `invalid_type_error` 代码库中为 0
- [x] ADR 02 注明 Zod 4
- [ ] **不 git commit**（由主会话决定）

## 回滚

锁文件还原 `zod@^3.25.0` + 撤销 schema 改动即可。
