# ADR 09：服务端目录组织与 API Client 生成（待定）

- **状态**：Deferred（初期功能完备后再评审）
- **日期**：2026-06-14
- **阶段**：Phase 1 后期 / Phase 2 前

## 背景

Phase 1 scaffold 已按 **技术分层** 落地（`routes/v1/`、`services/`、`middleware/`），Web 端使用 **`shared-types` + 手写 `lib/api`**（见 [multi-client.md](../multi-client.md)）。

开发过程中出现两个可选项，均不影响当前实现，但会在功能增多时影响维护成本与类型同步方式：

1. **服务端目录**：是否从「按层划分」改为「按域/模块划分」（如 `auth/routes.ts`、`auth/service.ts`、`auth/controller.ts`）？
2. **API Client**：是否引入从后端契约自动生成前端 API 方法的三方方案（Hono RPC、OpenAPI codegen 等）？

本文档记录选项与评审标准，**不在 Phase 1 初期变更现有结构**。

---

## 当前做法（暂不变）

| 维度 | 现状 | 依据 |
|------|------|------|
| 服务端目录 | 按层：`routes/v1/`、`services/`、`middleware/`、`lib/` | [architecture.md](../architecture.md)、[ADR 02](./02-backend-framework.md) |
| 跨端契约 SSOT | `@orbitchat/shared-types` | [ADR 04](./04-shared-packages.md) |
| Web API 调用 | 手写 `apps/web/src/lib/api/*` | [multi-client.md](../multi-client.md)、[ADR 03](./03-frontend-framework.md) |
| 多端 codegen 路径（规划） | OpenAPI → Flutter/RN（Phase 2+） | [ADR 04](./04-shared-packages.md) |

**原则**：文档与代码继续遵循 **spec → shared-types → 实现**；本 ADR 仅预留选型，不触发重构。

---

## 问题一：服务端目录 — 按层 vs 按域（Feature Module）

### 常见写法对比

| 方式 | 典型结构 | 优点 | 缺点 |
|------|----------|------|------|
| **A. 按层（当前）** | `routes/v1/auth.ts` + `services/authService.ts` | 职责边界清晰；与 Clean Architecture 文档一致；小团队易上手 | 改一个功能需跨目录跳转；域变大后 `services/` 文件堆积 |
| **B. 按域/模块** | `modules/auth/routes.ts`、`service.ts`、`schema.ts` | 功能内聚；ownership 清晰；类似 NestJS module | 跨域公共逻辑需额外 `shared/`；middleware 仍常全局 |
| **C. 混合** | `modules/auth/` 内含 route + service；全局 `middleware/`、`db/` | 兼顾内聚与基础设施分离 | 需约定模块边界，否则易重复 |

「Controller」在 Hono/Express 生态中通常对应 **route handler / router 文件**，职责是 HTTP 适配（解析请求、调 service、写响应），**不应**包含业务逻辑——无论目录用 A 还是 B，这与 [coding-rules.md](../coding-rules.md) 一致。

### 参考：NestJS 式模块（常见但非必须）

```
modules/auth/
  routes.ts       # 或 auth.router.ts — HTTP 适配
  service.ts      # 业务逻辑
  schema.ts       # Zod 请求体验证
  types.ts        # 模块内私有类型（跨端类型仍在 shared-types）
```

这在 NestJS、Adonis、部分 Express 项目中非常常见；Orbitchat 当前 **未采用**，但不排斥在 Phase 2 前评估迁移。

### 若未来迁移至按域，建议映射

| 现有路径 | 可能目标 |
|----------|----------|
| `routes/v1/auth.ts` | `modules/auth/routes.ts`（仍挂载到 `/api/v1/auth`） |
| `services/authService.ts`（待实现） | `modules/auth/service.ts` |
| `middleware/auth.ts` | 保留 `middleware/` 或 `modules/auth/middleware.ts`（仅 auth 专用时） |
| `db/schema/*` | 保持全局（表跨域共享） |

---

## 问题二：API Client — 手写 vs 自动生成

### 选项概览

| 选项 | 机制 | 与 REST `/api/v1` 关系 | Web（同 monorepo） | Flutter/RN |
|------|------|-------------------------|-------------------|------------|
| **0. 现状** | `shared-types` + 手写 `lib/api` | ✅ 完全 REST | 手动同步 | RN 可 import types；Flutter 需另路 |
| **1. Hono RPC** | 导出 `AppType`，`hc<AppType>()` | ⚠️ 非 REST 路径风格，需评估是否仍走 `/api/v1` | 类型推导，无 codegen | 不适用 |
| **2. tRPC** | 共享 router 类型 | ❌ 非 REST | 极佳 | 不适用 |
| **3. ts-rest** | 共享 contract router | ✅ REST 风格 | 好 | 需额外导出 OpenAPI |
| **4. @hono/zod-openapi + orval/kubb** | OpenAPI spec → 生成 client | ✅ REST | 生成 fetch/axios client | ✅ OpenAPI codegen |
| **5. 仅 OpenAPI，手写 Web** | 服务端出 spec，Web 仍手写 | ✅ REST | 半自动 | Flutter 主受益 |

[ADR 02](./02-backend-framework.md) 已提及 **Hono RPC** 与 **@hono/zod-openapi** 为 Phase 1+ 可评估项；[ADR 04](./04-shared-packages.md) 已规划 Flutter 走 **OpenAPI codegen**。

### 各方案简评

**0. 现状（shared-types + lib/api）**

- 优点：与 api-spec、多端 Header、Cookie 策略完全可控；学习成本低；Agent 易读。
- 缺点：端点增多后手写 client 重复；字段变更需同时改 shared-types 与 lib/api。

**1. Hono RPC**

- 优点：同仓库零 codegen，改 route 即改 client 类型。
- 缺点：契约绑定 Hono 应用类型；与「REST + `/api/v1` + 未来 Flutter OpenAPI」叙事需统一；Refresh/Cookie 等仍要封装层。

**2. tRPC**

- 优点：TS 全栈类型体验最好。
- 缺点：非 REST，与现有 api-spec、多端文档不一致；**与项目 REST 约定冲突大**，优先级低。

**3. ts-rest**

- 优点：契约即代码，REST 友好，可与 Zod 对齐。
- 缺点：需重构 route 定义方式；团队需熟悉 ts-rest 抽象。

**4. OpenAPI + orval（推荐作为 codegen 主路径候选）**

- 优点：Web 可生成也可手写；**Flutter 与 TS 共用同一份 spec**；与 api-spec 文档模型一致。
- 缺点：需维护 Zod/OpenAPI 与 shared-types 一致；CI 需 spec diff 校验（见 multi-client.md）。

**5. 混合（Phase 2 常见落地）**

- Web：继续 `shared-types` + `lib/api`，或局部采用 Hono RPC 仅内部工具页。
- Flutter：OpenAPI codegen。
- 服务端：逐步引入 `@hono/zod-openapi` 生成 spec，**不强制**立刻替换手写 client。

---

## 决策（当前）

**暂不变更。**

- Phase 1 继续：**按层目录** + **shared-types + 手写 lib/api**。
- 不在 auth/users 首批功能未完成前做目录重构或引入 RPC/tRPC。
- 本 ADR 状态保持 **Deferred**，待下方评审条件满足后再开 PR 更新为 Accepted 并写明最终选项。

---

## 评审时机与触发条件

建议在 **Phase 1 用户系统首批功能完备**（注册/登录/refresh/资料编辑可用）后，用 1–2 小时做评审：

### 目录组织（问题一）

| 信号 | 建议 |
|------|------|
| 单域文件 &lt; 3 个、团队 ≤ 2 人 | 维持按层 |
| `services/` 下 ≥ 5 个域且频繁跨文件修改 | 评估迁移至 `modules/<domain>/` |
| 新人反馈「找 auth 相关代码困难」 | 优先试点 `modules/auth/`，不一次性全迁 |

### API Client（问题二）

| 信号 | 建议 |
|------|------|
| 端点 &lt; 15，仅 Web + Server | 维持手写 lib/api |
| 启动 Flutter 客户端 | 优先 **@hono/zod-openapi + orval**，而非 tRPC |
| 端点 &gt; 30 或频繁改字段 | 引入 OpenAPI codegen 或 ts-rest；Web 可生成 client |
| 仅 Web、且希望零重复 | 试点 **Hono RPC** 于内部页面，不影响对外 REST 文档 |

### 评审产出（若决定变更）

1. 更新本 ADR 状态为 **Accepted**，写明选定方案。
2. 更新 [architecture.md](../architecture.md) 目录结构节。
3. 若涉及 client：更新 [multi-client.md](../multi-client.md) 与 CONTRIBUTING 工作流。
4. 单次 PR 只做一种迁移（目录 **或** codegen），避免大爆炸重构。

---

## 权衡（若未来变更）

| 变更 | 代价 |
|------|------|
| 按层 → 按域 | 大量文件移动、import 路径变更；需更新 Agent 规则与文档 |
| 引入 Hono RPC / tRPC | 与 REST api-spec 双轨或改契约叙事；多端一致性变复杂 |
| OpenAPI codegen | 构建链增加；需 CI 校验 spec ↔ shared-types |
| 维持现状 | 端点增多后手工同步成本上升（可接受至 Phase 2 初期） |

---

## 相关

- [02-backend-framework.md](./02-backend-framework.md) — Hono 目录与 RPC/OpenAPI 提及
- [03-frontend-framework.md](./03-frontend-framework.md) — Web `lib/api` 约定
- [04-shared-packages.md](./04-shared-packages.md) — shared-types SSOT、Flutter 路径
- [05-doc-first.md](./05-doc-first.md) — spec 先于代码
- [architecture.md](../architecture.md) — Phase 1 scaffold 结构
- [multi-client.md](../multi-client.md) — API Client 模式与检查清单
- [api-spec.md](../api-spec.md) — REST 契约

---

## 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| 0.1.0 | 2026-06-14 | 初始记录；状态 Deferred，待 Phase 1 初期功能完备后评审 |
