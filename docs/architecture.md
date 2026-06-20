# 架构设计 - Orbitchat

## 整体架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Layer                           │
├─────────────────────────────────────────────────────────────┤
│  Web (Next.js)  │  Mobile (Future)  │  Desktop (Future)    │
└────────────────┬────────────────────────────────────────────┘
                 │ HTTP/REST + WebSocket
┌────────────────▼────────────────────────────────────────────┐
│                    API Gateway Layer                         │
├─────────────────────────────────────────────────────────────┤
│              Bun Runtime + Hono Framework                    │
│         (Single Monolithic Backend - Phase 0-2)              │
└────────────┬───────────────────────────────────────────┬────┘
             │                                           │
┌────────────▼──────────────┐              ┌────────────▼────┐
│   Business Logic Layer    │              │  Infrastructure │
├───────────────────────────┤              ├──────────────────┤
│ - Services                │              │ - Database       │
│ - Domain Models           │              │ - Cache          │
│ - Validation              │              │ - File Storage   │
│ - Error Handling          │              │ - Auth           │
└───────────────────────────┘              └──────────────────┘

┌─────────────────────────────────────────────────────────────┐
│            Shared Code Layer (packages/)                    │
├─────────────────────────────────────────────────────────────┤
│  shared-types  │  shared-utils  │  ui (Future)              │
└─────────────────────────────────────────────────────────────┘
```

---

## 项目结构设计

### 目录组织原则

```
orbitchat/                    # Monorepo Root
├── apps/                     # 应用程序
│   ├── server/              # 后端应用
│   └── web/                 # Web 前端应用
├── packages/                # 共享包
│   ├── shared-types/        # 共享类型定义
│   ├── shared-utils/        # 共享工具函数
│   └── ui/                  # UI 组件库（预留）
├── docs/                    # 文档
├── AGENTS.md                # AI Agent 工作指南
└── [配置文件]
```

### 分层设计理由

**1. Monorepo 的好处**
- 共享类型 - 前后端通过 shared-types 保证 API 契约
- 共享工具 - 避免代码重复
- 版本一致性 - 所有包版本同步
- 便于 AI 理解 - Agent 可以看到完整的系统

**2. Apps vs Packages 分离**
- apps/ 包含可独立运行的应用（有 entry point）
- packages/ 包含可复用的库（可被 apps 和其他 packages 使用）

---

## 后端架构 - Bun + Hono

### 后端目录结构

```
apps/server/
├── src/
│   ├── index.ts              # 应用入口
│   ├── routes/               # API 路由
│   ├── middleware/           # 请求处理中间件
│   ├── services/             # 业务逻辑层
│   ├── lib/                  # 工具函数
│   ├── types/                # 本地类型
│   └── env.ts                # 环境变量
├── package.json
├── tsconfig.json
└── bunfig.toml
```

### 分层说明

```
HTTP 请求
  ↓
routes/ - 路由定义和 HTTP 处理
  ↓
middleware/ - 认证、错误处理、日志
  ↓
services/ - 业务逻辑（独立于 HTTP）
  ↓
lib/ - 工具和辅助函数
  ↓
shared-types/ - 类型定义
```

**分离的好处**：
- Services 独立于 HTTP，易于测试
- Services 可被多种接口调用
- 清晰的职责边界
- 易于维护和扩展

---

## 前端架构 - Next.js

### 前端目录结构

```
apps/web/
├── src/
│   ├── app/                  # App Router 路由
│   ├── components/           # React 组件
│   ├── hooks/                # Custom Hooks
│   ├── lib/                  # 工具函数
│   ├── types/                # 本地类型
│   └── styles/               # 样式
├── package.json
└── tsconfig.json
```

### 特点说明

- 使用 App Router（Next.js 14+）
- 通过 `lib/api.ts` 统一 API 通信
- 导入共享类型和工具

---

## 共享包设计

### shared-types

集中管理所有 API 契约和域模型：

```
packages/shared-types/src/
├── api/              # API 相关类型
├── domain/           # 业务域类型
├── utils/            # 类型工具函数
└── index.ts
```

### shared-utils

前后端通用工具函数：

```
packages/shared-utils/src/
├── validators/       # 数据验证
├── formatters/       # 数据格式化
├── api/              # API 工具
└── index.ts
```

---

## 设计模式

### 1. Clean Architecture

分层设计确保：
- 业务逻辑独立于框架
- 易于单元测试
- 易于替换依赖

### 2. 类型驱动开发

- API 契约由 TypeScript 类型定义
- 前后端通过共享类型保证一致
- 类型即文档

### 3. 统一错误处理

- 自定义 AppError 类
- 中间件统一处理错误
- 清晰的错误消息

---

## 扩展路径

### 短期（Phase 1-2）

```
当前单体 → 数据库集成
API Routes → 完整的 CRUD
单一模块 → 多个业务模块
```

### 中期（Phase 3+）

```
实时通信 → WebSocket
缓存系统 → Redis
事件系统 → Event Bus
```

### 长期愿景

```
微服务架构
分布式系统
多地域部署
```

---

## 详细设计决策

详见 `decisions/` 目录（Phase 0：01–05；Phase 1：06–08）。

---

## 多端架构（简要）

> 详细客户端规范见 [multi-client.md](./multi-client.md)。实现 Phase 1 时可再细化本节。

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  Web        │  │ Orbitchat-rn│  │  Desktop    │
│  Next.js    │  │  iOS/Android│  │  (future)   │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │    HTTPS /api/v1 + WS /ws/v1     │
       └────────────────┬─────────────────┘
                        ▼
              ┌───────────────────┐
              │  Hono API (Bun)   │
              │  apps/server      │
              └─────────┬─────────┘
                        │
         ┌──────────────┼──────────────┐
         ▼              ▼              ▼
   PostgreSQL      (Redis 未来)   Storefront 服务
   Drizzle ORM     Phase 3+       Go 等 Phase 4+
```

**原则**：
- 所有客户端共享 `/api/v1/*`；类型 SSOT 在 `@orbitchat/shared-types`
- 认证：Session 表 + 双 Token（ADR 08）；同平台单 Session，跨平台可同时在线
- 业务 API 不在 Next.js 实现（ADR 03）

---

## 服务边界（简要）

| 模块 | 运行时 | 阶段 |
|------|--------|------|
| 用户 / 认证 / 社交 / 聊天 API | Hono monolith | Phase 1–3 |
| 个人橱窗（交易、库存） | 独立服务（Go 等，待定） | Phase 4–5 |
| 静态资源 / 媒体 | 对象存储 + CDN | Phase 4 |

橱窗服务通过 Hono **网关路由** 代理（如 `/api/v1/storefront/*` → 内部 gRPC/HTTP），认证仍由 Hono 统一 JWT 校验。

*具体网关配置、服务间契约在 Phase 4 启动前补充 ADR。*

---

## 后端目标结构（Phase 1 scaffold）

```
apps/server/src/
├── index.ts
├── env.ts
├── db/schema/          # Drizzle（ADR 07）
├── routes/v1/          # auth, users, ...
├── middleware/         # auth, client-meta, error
├── services/           # 业务逻辑
└── lib/                # errors, crypto
```

*目录随模块增加；每新增域路由时更新本节或链接至 ADR 02。*

**待定选型**（初期功能完备后再评审，暂不变更）：服务端 **按层 vs 按域（feature module）** 目录、以及 **API Client 手写 vs 自动生成**（Hono RPC / OpenAPI codegen 等）。见 [ADR 09 — server-layout-and-api-codegen](./decisions/09-server-layout-and-api-codegen.md)。

