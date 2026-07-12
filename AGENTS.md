# AGENTS.md - Orbitchat AI Agent 工作指南

> 🤖 本文档是 Orbitchat 项目的指南针。  
> 所有 AI Agent（Cursor、Claude、Copilot 等）**必须**优先阅读此文档。

---

## 快速开始

### 第一次接触本项目？

按以下顺序阅读：

1. **本文件（AGENTS.md）** ← 你在这里
2. `docs/product.md` - 理解产品目标
3. `docs/architecture.md` - 理解系统设计
4. `docs/architecture-principles.md` - 理解架构原则（依赖、边界、一致性）
5. `docs/coding-rules.md` - 理解编码规范
6. `docs/env.md` - 环境变量（开发前）
7. `CONTRIBUTING.md` - 贡献与 PR 流程
8. 开始开发

---

## 项目信息

### 项目名称

**Orbitchat** - 一个学习型社交平台项目

### 项目阶段

**Phase 4 Orbit Guide（Wave 0–5 代码完成，待交付）**（2026-07-10）

分支 `feat/api-robustness-concurrency`：API 健壮性 + 群管理扩展 + 小轨 Wave 1–5（平台感知 / M1 记忆 / M2 RAG / M3 摘要 / UX）。**本地未 commit**，自动化：**217 server tests + 37 E2E** 通过。

**下一步（Wave 0）**：拆 PR → push → 合 `master`；可选 UI 改版后手测。

### 项目特征

- ✅ 长期演进项目（不是一次性产品）
- ✅ 文档驱动开发（代码遵循文档）
- ✅ TypeScript First（strict mode 必须）
- ✅ AI Agent 友好（清晰的结构和命名）
- ✅ Agentic Engineering（AI 协作开发）

---

## 项目结构速览

```
orbitchat/
├── apps/
│   ├── server/          # 后端 (Bun + Hono)
│   └── web/             # 前端 (Next.js)
├── packages/
│   ├── shared-types/    # 共享类型
│   ├── shared-utils/    # 共享工具
│   └── ui/              # UI 组件库（预留）
├── docs/                # 📚 完整的文档体系
├── AGENTS.md            # 本文件
└── [配置文件]
```

---

## 技术栈

### 后端

- **运行时**：Bun（现代 JS/TS 运行时）
- **框架**：Hono（轻量级 Web 框架）
- **语言**：TypeScript（strict mode）

### 前端

- **框架**：Next.js 14+（App Router）
- **语言**：TypeScript（strict mode）

### Monorepo

- **工具**：pnpm workspace
- **原因**：前后端共享类型和工具

### 共享包

- `shared-types` - API 契约和域模型
- `shared-utils` - 前后端通用工具

---

## 架构原则

### 1️⃣ Clean Architecture（分层架构）

后端按以下分层组织：

```
HTTP Routes
  ↓
Middleware (认证、错误处理)
  ↓
Services (业务逻辑)
  ↓
Utils & Helpers
  ↓
shared-types (类型定义)
```

**好处**：
- 业务逻辑独立于框架
- 易于测试和维护
- 清晰的职责边界

### 2️⃣ Type-Driven Development（类型驱动开发）

所有数据类型集中在 `shared-types`：

```typescript
// ✅ 统一定义
packages/shared-types/src/domain/user.ts
export interface User { ... }

// ✅ 前后端都导入
import type { User } from '@orbitchat/shared-types';
```

**好处**：
- API 契约明确
- 前后端一致性
- 类型即文档

### 3️⃣ Error Handling（统一错误处理）

使用自定义 `AppError` 类：

```typescript
// lib/errors.ts
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500
  ) { /* ... */ }
}

// middleware 中统一处理
app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json({ code: err.code, message: err.message }, err.statusCode);
  }
  return c.json({ code: 'INTERNAL_ERROR' }, 500);
});
```

### 4️⃣ Document-First Development（文档优先）

所有决策优先体现在文档：

1. 📝 编写文档 (what, why, how)
2. 💻 编写代码 (实现文档)
3. 🔄 保持同步 (更新文档)

**文档位置**：`docs/` 目录

---

## 编码规范

### TypeScript 严格模式

❌ **禁止**：
- 使用 `any` 类型
- 隐式的 `any`
- 未声明的返回类型

✅ **必须**：
- 所有参数有类型
- 所有函数有返回类型
- 完整的类型定义

### 命名约定

| 类型 | 规则 | 例子 |
|-----|------|------|
| 文件 | PascalCase(组件) / camelCase(工具) | `UserCard.tsx`, `formatDate.ts` |
| 变量 | camelCase | `const userName = 'John'` |
| 常量 | UPPER_SNAKE_CASE | `const MAX_RETRIES = 3` |
| 类 | PascalCase | `class UserService {}` |
| 接口 | PascalCase | `interface User {}` |
| 布尔 | is/has/can 前缀 | `const isActive = true` |

### 代码质量

- 单一职责原则
- 避免深度嵌套
- 清晰的注释（解释为什么，不是什么）
- 统一的错误处理

**详见** `docs/coding-rules.md`

---

## 当前阶段范围（Phase 3B + 4B 已交付）

### ✅ 已完成

- Phase 1–2、Phase 3A 1:1 私聊
- **Phase 3B**：群聊 MVP + 群管理（角色/踢人/转让/改群名）+ **私聊 typing**
- Phase 4A AI Chat MVP
- **Phase 4B**：FC 写工具（`send_dm`、`create_post`、`follow`/`unfollow`）+ **`play_tictactoe`**

### ❌ 暂不做 / 后续

- 群邀请链接（3B.1 P1）、presence、群头像
- Redis Pub/Sub 多实例、WebRTC（4C）、推送（3.1）
- M1 长期记忆 / M2 RAG（见 [phase-4-agent-memory-rag-plan.md](./docs/phase-4-agent-memory-rag-plan.md)）
- 生产部署编排

**下一步**：UI 改版 + 整体手测；或按 [phase-3b-4b-closeout.md](./docs/phase-3b-4b-closeout.md) 选轨推进。

---

## 文档体系

本项目拥有完整的文档体系，所有重要信息都应先体现在文档中。

### 核心文档（必读）

| 文档 | 内容 | 何时读 |
|-----|------|--------|
| `docs/product.md` | 产品定义、目标、功能规划 | 第一步 |
| `docs/architecture.md` | 系统架构、目录结构、设计原因 | 第二步 |
| `docs/architecture-principles.md` | 架构原则（依赖、边界、失败隔离等） | 设计/评审时 |
| `docs/coding-rules.md` | 编码规范、命名约定、最佳实践 | 开发前 |
| `docs/api-spec.md` | API 规范、数据契约、端点定义 | API 开发时 |
| `docs/decisions/18-api-robustness.md` | API 健壮性原则与验收 | 写/改写 API 时 |
| `docs/api-robustness-audit.md` | 全量 endpoint 健壮性审计表 | API 审查时 |
| `docs/multi-client.md` | 多端 Token 存储、API Client、Session | 客户端开发时 |
| `docs/env.md` | 环境变量 | 本地启动 / 部署前 |
| `CONTRIBUTING.md` | 贡献流程与 PR 规范 | 提交代码前 |

### 参考文档

| 文档 | 内容 |
|-----|------|
| `docs/db-schema.md` | 数据库设计 | 数据库设计时 |
| `docs/sql-learning.md` | SQL / 索引学习与实战对照 | 写查询、Feed、调性能时 |
| `docs/roadmap.md` | 项目路线图、分阶段计划 |
| `docs/orbit-guide-agent-implementation.md` | **小轨 Agent 实现学习指南**（架构、链路、Tool、Wave 1–5） |
| `docs/phase-4-orbit-guide-plan.md` | 小轨能力演进路线图与验收 |
| `docs/decisions/` | 架构决策记录（ADR 01–22） |

---

## 开发工作流

### 新功能开发

1. **查阅文档** - 理解需求和设计
2. **查找相关代码** - 理解现有实现
3. **编写类型** - 在 `shared-types` 中定义
4. **编写实现** - 遵循文档和规范
5. **编写测试** - 验证实现正确
6. **更新文档** - 记录变更

### 代码审查关键点

- [ ] 是否遵循 TypeScript strict mode？
- [ ] 是否使用了 `any`？
- [ ] 函数是否有完整的类型？
- [ ] 命名是否清晰？
- [ ] 是否遵循 Clean Architecture？
- [ ] 错误处理是否完善？
- [ ] 文档是否同步更新？

---

## 常见问题和答案

### Q1: 我想添加新的 npm 包，应该怎么做？

**A**：在根目录或相关 workspace 的 `package.json` 中添加，然后运行 `pnpm install`。

### Q2: 我想创建一个新的 API 端点，流程是什么？

**A**：
1. 更新 `docs/api-spec.md` 描述端点
2. 在 `shared-types` 中定义请求/响应类型
3. 在 `apps/server/src/routes/` 中实现
4. 在 `apps/server/src/services/` 中编写业务逻辑

### Q3: 为什么有这么多文档？

**A**：因为这是一个学习项目，文档帮助：
- AI Agent 快速理解意图
- 团队成员保持一致
- 决策过程可追溯
- 代码实现有章可循

### Q4: 当前阶段应该专注什么？

**A**：Phase 1 完整验收已完成；下一步 **push + PR** 合 `main`，或进入 Phase 2 规划（见 roadmap）。

### Q5: 我发现代码和文档不一致怎么办？

**A**：优先相信文档。文档是意图，代码是实现。如果不一致，更新代码使其遵循文档。如果需要改变设计，先更新文档再改代码。

---

## 获取帮助

### 遇到问题时的检查清单

1. **查阅相关文档** - 答案可能在 `docs/` 中
2. **查看现有代码** - 是否有类似的实现？
3. **阅读编码规范** - 是否违反了某条规则？
4. **查看 git log** - 历史决策是什么？

### 获取答案的推荐顺序

1. 📚 AGENTS.md（本文件）
2. 📚 docs/ 下的相关文档
3. 💻 项目代码
4. 🔍 git 历史和提交信息

---

## AI Agent 特别说明

### 为什么需要这个文档？

作为 AI Agent，你可能需要在不同时间、不同上下文中处理这个项目。本文档确保你：

1. **快速定位** - 知道从哪里开始
2. **理解意图** - 明确项目目标和原则
3. **避免错误** - 了解当前阶段的限制
4. **保持一致** - 遵循既定的规范和模式

### 推荐的工作模式

```
新任务 → 读 AGENTS.md → 读相关文档 → 查看现有代码 → 实现 → 更新文档
```

### 特别提醒

⚠️ **重要**：
- 先读 `.cursor/rules/orbitchat.mdc` 与本文件
- Phase 1 代码：spec → shared-types → 实现（见 CONTRIBUTING.md）
- 不要使用 `any` 类型
- 文档即真理，代码遵循文档
- 业务 API 必须使用 `/api/v1/*` 前缀

---

## 下一步

### 立即可做的事

1. ✅ 阅读 `docs/product.md` 理解产品
2. ✅ 阅读 `docs/architecture.md` 理解架构
3. ✅ 查看项目目录结构
4. ✅ 运行 `pnpm install` 安装依赖

### Phase 0 已完成 ✅

- [x] 创建 apps/server 基础项目（Bun + Hono，含 `/health`）
- [x] 创建 apps/web 基础项目（Next.js App Router）
- [x] 创建 packages/*（shared-types、shared-utils、ui）
- [x] 编写 Phase 0 ADR（`docs/decisions/01`–`05`）
- [x] 文档第一批完善（product、api-spec、roadmap 同步）

### Phase 1 代码实现

#### 已完成 ✅

- [x] 2.9 Drizzle schema（`users`、`profiles`、`user_sessions`）+ 迁移
- [x] 2.10 `shared-types` domain + `api/v1` 类型
- [x] 2.11 后端 scaffold（`routes/v1/`、`middleware/`、`services/`、`lib/`、`env.ts`）
- [x] 2.12 Web `lib/api` client
- [x] Docker Compose 本地基础设施（Postgres、Redis）
- [x] 2.13 auth service + `/api/v1/auth/*` 业务逻辑
- [x] 2.14 `/api/v1/users/*` 业务逻辑
- [x] 2.14 Web 登录 / 注册 / Profile 页（`auth-context`）

#### 待办 📋

- [x] **2.15** 初次开发启动测试（Docker + migrate + 端到端验证）
- [x] **完整验收 B**（会话页、账号编辑、注册自动登录、7 E2E、错误信封统一）
- [ ] **push + PR** 合 `main`（分支已在本地，未 push）
- [ ] **可选** Redis 接入、Compose 生产草案、ADR 09 — 见「会话交接 → 剩余项」

> 评审待定：服务端目录组织、API Client 自动生成 — 见 [ADR 09](./docs/decisions/09-server-layout-and-api-codegen.md)

---

### 会话交接（下次继续）

**结论（2026-07-10）**：`feat/api-robustness-concurrency` 本地完成 Wave 0–5 + 测试补齐；**未 push/合 main**。

| 维度 | 状态 |
|------|------|
| API 健壮性 + 群公告/邀请/消息策略（0009–0013） | ✅ 代码 |
| 小轨 Wave 1–5（Tool / 记忆 / RAG / 摘要 / UX） | ✅ 代码 |
| 单测 + E2E | ✅ 217 + 37 |
| 迁移 journal + pgvector 容错 | ✅ |
| Git 交付（commit / PR / merge） | ⏸ 待做 |
| 手测 / UI 改版 | ⏸ 用户计划 |

**本地开发速查**

| 项 | 说明 |
|----|------|
| 启动 | 根目录 `pnpm dev` |
| API / Web | http://localhost:3001/health 、http://localhost:3000 |
| DB 迁移 | `pnpm --filter @orbitchat/server db:migrate`（**0009–0016**） |
| E2E | `CI=true pnpm e2e`（`LLM_E2E_MOCK=true`，`RAG_ENABLED=false`） |
| RAG 全量重建 | `cd apps/server && bun scripts/reindex-rag.ts`（需 `RAG_ENABLED=true` + pgvector） |

**建议下一迭代**：见 [phase-4-orbit-guide-plan.md](./docs/phase-4-orbit-guide-plan.md) § Wave 0；学习指南 [orbit-guide-agent-implementation.md](./docs/orbit-guide-agent-implementation.md)。

**关键回顾**：[phase-3b-4b-closeout.md](./docs/phase-3b-4b-closeout.md) · [phase-4-orbit-guide-plan.md](./docs/phase-4-orbit-guide-plan.md)

### 联系和反馈

如有问题或建议，请：
1. 更新相关文档
2. 提交代码审查
3. 在 git 提交信息中记录决策

---

## 最后的话

> 这个项目的目标不是快速完成功能，而是建立一个清晰、可维护、易于理解的系统。  
> 每一行代码都应该反映我们的设计意图。  
> 文档和代码一样重要，甚至更重要。

**欢迎加入 Orbitchat 的开发 🚀**

---

## 版本

- **当前版本**：0.1.0
- **最后更新**：2026-07-07（3B+4B 合入 master；见 phase-3b-4b-closeout）
- **下次审查**：UI 改版后整体手测，或启动 3B.1 邀请链接 / M1 记忆轨
