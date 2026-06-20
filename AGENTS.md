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

**Phase 1: User System — 主链路与本地验证已完成，进入补强阶段**（2026-06-20）

Phase 0 交付：Monorepo、基础框架、文档体系、ADR 01–08。  
Phase 1 交付：Drizzle 迁移、auth/users API、Web 登录/注册/Profile、Bun 单测、Playwright E2E；本地 Docker/复用 `im-postgres` 路径已验证。

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

## 当前阶段范围（Phase 1）

### ✅ 可以做 / 已完成

- Phase 1 用户系统：注册、登录、Session、Profile（见「会话交接」）
- 本地 Docker + migrate + 端到端验证
- 可选：设备与会话 Web UI、ESLint flat config

### ❌ 暂不做（Phase 2+）

- 动态 / Feed / 关注 / 搜索
- 文字聊天 / WebSocket
- Redis 接入（Compose 已预置）
- 性能优化与生产部署

**下一步优先**：继续补强 Phase 1 体验与测试覆盖，优先看 AGENTS.md → 会话交接 → 次要缺口。

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
| `docs/db-schema.md` | 数据库设计（当前为空） |
| `docs/roadmap.md` | 项目路线图、分阶段计划 |
| `docs/decisions/` | 架构决策记录（ADR 01–08） |

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

**A**：优先完成 **Phase 1 补强**。主链路已打通，当前更适合继续做浏览器 E2E 扩展、设备与会话页、账号字段编辑，或在此基础上开始 Phase 2 规划。

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
- [ ] **可选** 次要缺口择项处理 — 见下方「会话交接 → 次要缺口」表（#2–#8）

> 评审待定：服务端目录组织、API Client 自动生成 — 见 [ADR 09](./docs/decisions/09-server-layout-and-api-codegen.md)

---

### 会话交接（下次继续）

**结论（2026-06-20）**：Phase 1 用户系统**主链路代码与本地验证已贯通**；已复用现有 `im-postgres` 完成 migrate 与手动链路验证，`pnpm test`、`pnpm type-check`、`pnpm lint` 通过。

| 维度 | 状态 |
|------|------|
| Phase 0 | ✅ 完成 |
| Phase 1 代码 2.9–2.14 | ✅ 完成 |
| Phase 1 本地验证 | ✅ 完成 — migrate / API / Web 已验证 |
| Phase 2+ | 未开始 |

**本地环境状态（末次会话 2026-06-20）**

| 项 | 状态 |
|----|------|
| Docker 守护进程 | ✅ 正常 |
| `apps/server/.env` | ✅ 已存在 |
| `apps/web/.env.local` | ✅ 已创建 |
| `im-postgres` | ✅ 复用中；已创建 `orbitchat` role + DB |
| `im-redis` | ✅ 运行中；Phase 1 未接入代码 |
| `orbitchat-postgres` | ⚠️ 历史失败残留容器，可后续清理 |
| DB migrate | ✅ 已执行 |
| API 手动验证 | ✅ 注册 / 登录 / Profile 编辑 / 登出 / refresh 失效 已验证 |
| Web 启动验证 | ✅ 首页 `/` 与登录页 `/login` 已返回 200 |

**本次采用路径**：未删除 `im-*` 容器；直接复用 `im-postgres`，在其中创建 `orbitchat` 用户与独立数据库，保持 `apps/server/.env` 现有 `DATABASE_URL` 不变。

**下次 Agent 建议执行顺序**

0. **可选清理历史残留**（非阻塞）：
   ```bash
   docker rm -f orbitchat-postgres 2>/dev/null || true   # 清除失败的 Created 容器
   ```
1. 若继续复用 `im-postgres`：确认数据库可达
   ```bash
   docker exec im-postgres psql -U im -d postgres -tAc "SELECT datname FROM pg_database;"
   ```
2. 启动应用（根目录或分终端）：
   ```bash
   cd /Users/populus/workspace/orbitchat/apps/server && pnpm start
   cd /Users/populus/workspace/orbitchat/apps/web && pnpm dev
   ```
   - API：默认 `http://localhost:3001/health`
   - Web：默认 `http://localhost:3000`
3. **优先扩展 Playwright E2E**：当前已覆盖 3 条场景
   - 注册 → 登录 → Profile 编辑 → 登出
   - 未登录访问 `/profile` 自动跳转 `/login`
   - 错误密码登录显示 `Invalid credentials`
   下一步更值得补“会话管理 / 登出后刷新保持未登录 / 注册表单校验”等场景
4. 可选：设备与会话 Web UI、账号字段编辑、Phase 2 规划

> 若后续不再复用 `im-postgres`：可改回专属 compose 容器，或改 `docker-compose.yml` 端口（如 Postgres `5433`）并同步 `DATABASE_URL` — 见 [env.md](./docs/env.md#端口冲突)。

**已实现能力**

| 模块 | 内容 |
|------|------|
| DB | Drizzle schema + `drizzle/0000_*.sql` |
| API | `/api/v1/auth/*`（8 端点）、`/api/v1/users/*`（4 端点） |
| 认证 | Session + 双 Token、同端 SSO、refresh rotation、信任设备（API 层） |
| Web | `/login`、`/register`、`/profile`、`lib/api`、`auth-context` |
| 密码 | bcrypt（`Bun.password`，cost 10） |
| 测试 | `bun:test` + Playwright 已覆盖服务层 / 路由 / 中间件 / Web API client / 浏览器 3 条核心场景 |

**次要缺口（不阻塞主链路，下次可择项处理）**

| # | 类别 | 缺口 | 说明 |
|---|------|------|------|
| 1 | 测试 | Playwright 核心场景 | ✅ 7 条：主链路、未登录跳转、错误登录、弱密码、账号编辑、会话页 |
| 2 | Web UI | 设备与会话设置页 | ✅ `/settings/sessions` |
| 3 | Web UI | 账号字段编辑 | ✅ Profile 接 `PATCH /users/:id` |
| 4 | Web UX | 注册后自动登录 | ✅ 注册成功前端串联 login |
| 5 | 基础设施 | Redis 未接入代码 | `docker-compose.yml` 已起 Redis，server 无 `REDIS_URL` 使用（Phase 3+ 规划） |
| 6 | 基础设施 | 专属 compose 数据库未使用 | 当前默认复用 `im-postgres`；后续若要彻底隔离，可恢复专属容器 |
| 7 | 架构 | ADR 09 待定 | 按域目录 vs 按层、API Client codegen — 状态 **Deferred**，见 ADR 09 |
| 8 | 文档 | 后续需随新 E2E / UI 缺口继续同步 | 当前会话已同步 Phase 1 本地验证与浏览器 E2E 状态 |

> 以上不影响「注册 → 登录 → 编辑 Profile → 登出」主路径；当前更适合优先补设备与会话页、账号字段编辑，或进入 Phase 2 规划。

**关键文件索引**

```
apps/server/src/services/auth-service.ts   # 认证编排
apps/server/src/routes/v1/auth.ts          # auth 路由
apps/server/src/routes/v1/users.ts         # users 路由
apps/web/src/contexts/auth-context.tsx     # Web 认证状态
apps/web/src/app/login|register|profile/   # 页面
docker-compose.yml                         # Postgres + Redis
docs/env.md                                # 环境变量与 Docker 说明
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

- **当前版本**：0.0.6
- **最后更新**：2026-06-20（2.15 已完成：复用 `im-postgres` 跑通 migrate、本地 API 与 Web 验证）
- **下次审查**：扩展 Playwright E2E；评估设备与会话页 / 账号字段编辑 / Phase 2 规划
