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
4. `docs/coding-rules.md` - 理解编码规范
5. `docs/env.md` - 环境变量（开发前）
6. `CONTRIBUTING.md` - 贡献与 PR 流程
7. 开始开发

---

## 项目信息

### 项目名称

**Orbitchat** - 一个学习型社交平台项目

### 项目阶段

**Phase 3A + 4A + 4B（send_dm）— 开发完成，待 PR**（2026-07-05）

Phase 0–2 已完成；当前分支 `feat/phase-3-agent` 交付 **Phase 3A 切片 + Phase 4A + Phase 4B 汇合点**（完整 Phase 3/4 仍各只做一部分）。回顾见 [phase-3-agent-closeout.md](./docs/phase-3-agent-closeout.md)；**后续并行计划**见 [phase-3-4-next-plan.md](./docs/phase-3-4-next-plan.md)。

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

## 当前阶段范围（Phase 3A + Agent）

### ✅ Phase 1–3A 与 Agent MVP 已完成开发

- Phase 1：用户系统（auth、profile、sessions、E2E）
- Phase 2：社交（posts、feed、follow、search、评论；ADR 10–12；见 [phase-2-closeout.md](./docs/phase-2-closeout.md)）
- Phase 3A：1:1 私聊（REST + WebSocket + Web `/messages`；ADR 13–15）
- Phase 4A：AI Chat MVP（本地模型、REST + SSE、Web `/ai`；ADR 17）
- Phase 4B 汇合点：`send_dm` pending tool call + 用户确认 + `ai_tool_calls` 审计

### ❌ 暂不做（后续阶段）

- Phase 3B 群聊、typing、presence
- Redis Pub/Sub 多实例广播（Compose 已预置，代码未接）
- WebRTC 信令与音视频
- RAG / LangGraph / 独立 Python Agent Runtime
- 生产部署编排

**下一步优先**：合并 PR；然后按 [phase-3-4-next-plan.md](./docs/phase-3-4-next-plan.md) 推进 **3B 群聊（Track M）** 与 **4B Tool 扩展（Track A）**（可并行）。

---

## 文档体系

本项目拥有完整的文档体系，所有重要信息都应先体现在文档中。

### 核心文档（必读）

| 文档 | 内容 | 何时读 |
|-----|------|--------|
| `docs/product.md` | 产品定义、目标、功能规划 | 第一步 |
| `docs/architecture.md` | 系统架构、目录结构、设计原因 | 第二步 |
| `docs/coding-rules.md` | 编码规范、命名约定、最佳实践 | 开发前 |
| `docs/api-spec.md` | API 规范、数据契约、端点定义 | API 开发时 |
| `docs/multi-client.md` | 多端 Token 存储、API Client、Session | 客户端开发时 |
| `docs/env.md` | 环境变量 | 本地启动 / 部署前 |
| `CONTRIBUTING.md` | 贡献流程与 PR 规范 | 提交代码前 |

### 参考文档

| 文档 | 内容 |
|-----|------|
| `docs/db-schema.md` | 数据库设计 | 数据库设计时 |
| `docs/sql-learning.md` | SQL / 索引学习与实战对照 | 写查询、Feed、调性能时 |
| `docs/roadmap.md` | 项目路线图、分阶段计划 |
| `docs/decisions/` | 架构决策记录（ADR 01–17） |

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

**结论（2026-07-05）**：`feat/phase-3-agent` 已交付 3A + 4A + 4B `send_dm`；文档已同步 [product.md](./docs/product.md)、[roadmap.md](./docs/roadmap.md)、[phase-3-4-next-plan.md](./docs/phase-3-4-next-plan.md)。

| 维度 | 状态 |
|------|------|
| Phase 0–1 | ✅ 完成 |
| Phase 2 | ✅ 完成 |
| Phase 3A 私聊 | ✅ 开发完成；E2E 新增中 |
| Phase 4A AI Chat | ✅ 开发完成；本地模型手动验收待跑 |
| Phase 4B `send_dm` | ✅ pending tool call + 确认执行已实现 |
| Git | ⚠️ 当前改动未提交，分支 `feat/phase-3-agent` |

**本地开发速查**

| 项 | 说明 |
|----|------|
| 启动 | 根目录 `pnpm dev`（并行 server `--hot` + web） |
| API | http://localhost:3001/health |
| Web | http://localhost:3000 |
| DB | 复用 `im-postgres` + `orbitchat` 库；`docker-compose.yml` 容器名 `im-postgres` / `im-redis` |
| 注册密码 | 至少 8 位 + 大小写 + 数字（例 `Password123`） |
| LLM | `LLM_BASE_URL=http://localhost:11434/v1`，`LLM_MODEL=llama3.2` |

**下次 Agent 建议顺序**

1. 跑 `pnpm e2e -- apps/web/e2e/chat-agent-flow.spec.ts` 并修复等待/选择器问题。
2. 跑全量 `pnpm type-check && pnpm lint && pnpm --filter @orbitchat/server test && pnpm --filter @orbitchat/web build`。
3. 本地有 Ollama 时手动验收 `/ai` SSE 回复与 `send_dm` Approve。
4. 准备 PR；不要自动 commit，除非用户明确要求。

**已实现能力**

| 模块 | 内容 |
|------|------|
| DB | P1/P2 表 + P3 conversations/messages + AI `agents`/`ai_*`/`ai_tool_calls` |
| API | auth、users、feed/posts/follow/search、conversations/messages、AI REST/SSE |
| Realtime | `WS /ws/v1/chat`、ChatHub、`message.new`、`message.read` |
| Web | `/feed`、`/search`、`/users/[id]`、`/messages`、`/ai` |
| 测试 | server 68 pass；新增 chat/agent E2E |
| 文档 | ADR 13–15/17 Accepted；`phase-3-agent-master-plan.md`、`phase-3-agent-closeout.md` |

**剩余项**

| # | 项 | 说明 |
|---|-----|------|
| 1 | E2E | 跑新增 chat/agent flow |
| 2 | 本地模型验收 | 需要 Ollama / OpenAI-compatible local model |
| 3 | Redis | 多实例 Pub/Sub 后续接入 |
| 4 | 生产部署 | Compose+VPS 可行；prod compose / Caddy 草案未写 |
| 5 | ADR 09 | Deferred |

**关键文件索引**

```
apps/server/src/lib/zod-hook.ts            # Zod → ErrorResponse
apps/server/src/realtime/chat-hub.ts       # P3 ChatHub
apps/server/src/routes/v1/conversations.ts
apps/server/src/routes/v1/ai.ts
apps/server/src/services/message-service.ts
apps/server/src/services/ai/
apps/web/src/app/messages/
apps/web/src/app/ai/
docker-compose.yml                         # im-postgres / im-redis
docs/env.md
docs/phase-3-agent-closeout.md
```

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
- **最后更新**：2026-07-05（3A+4A+4B 切片交付；P3/P4 后续见 phase-3-4-next-plan.md）
- **下次审查**：新增 E2E 通过后准备 PR
