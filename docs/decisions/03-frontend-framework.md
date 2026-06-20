# ADR 03：前端框架（Next.js App Router）

- **状态**：Accepted
- **日期**：2026-06-14
- **阶段**：Phase 0

## 背景

Orbitchat Web 端需要现代 React 开发体验、良好的 SEO/首屏性能，且能与 Hono API 及 `shared-types` 共享类型。未来 Orbitchat-rn 将复用 API 契约和部分业务逻辑，Web 端不应与后端过度耦合。

## 选项

1. **Vite + React SPA**
   - 优点：简单、构建快
   - 缺点：无 SSR、SEO 弱、需自建路由和数据获取模式

2. **Remix**
   - 优点：Web 标准、嵌套路由、loader/action 模式清晰
   - 缺点：团队/生态相对 Next 小，与现有文档体系需重建

3. **Next.js 14+ App Router**
   - 优点：RSC、Server Components、成熟生态、与 Vercel/自托管均兼容
   - 缺点：RSC/Client 边界需学习；API Routes 易与 Hono 职责混淆

4. **Next.js Pages Router**
   - 优点：模式成熟
   - 缺点：官方主推 App Router，长期维护成本高

## 决策

选择 **Next.js 14+ App Router**（`apps/web`）。

## 原因

- **App Router 是 Next 默认方向**：Layout、Loading、Error boundary 一等公民，适合社交类多页面应用。
- **Server / Client 分离**：Feed、资料等可读数据优先 RSC；聊天、互动用 Client Component + WebSocket。
- **API 职责清晰**：业务 API 由 Hono（`apps/server`）提供；Next.js **不**承载核心业务 API（避免双后端）。Next Route Handlers 仅用于 BFF 代理或 SSR 专用场景（Phase 2+ 按需）。
- **类型共享**：Web 通过 `@orbitchat/shared-types` + 统一 `lib/api.ts` 调用 Hono，与 RN 使用相同契约。
- **未来 RN 对齐**：Orbitchat-rn 复用 shared-types 与 API client 模式，UI 层独立（packages/ui 仅 Web）。

## 权衡

- 开发时 Web 需配置 API 基址（`NEXT_PUBLIC_API_URL=http://localhost:3001`），避免误用 Next API Routes 代替 Hono。
- RSC 不能直接调用需 Cookie/Token 的客户端 fetch 时，使用 Server Actions 或 Route Handler 作薄代理。

## 后续（Next.js 生态最佳实践）

### 目录结构

```
apps/web/src/
├── app/                 # App Router（路由即目录）
│   ├── layout.tsx
│   ├── page.tsx
│   └── (auth)/          # 路由组
├── components/          # UI 组件（Client 默认标注 'use client'）
├── hooks/               # 客户端 hooks
├── lib/
│   └── api/             # 类型安全 API client（消费 shared-types）
└── styles/
```

### 数据获取策略

| 场景 | 方式 |
|------|------|
| 首屏列表、公开资料 | Server Component + fetch（带 cache/revalidate） |
| 用户交互、表单 | Client Component + `lib/api` |
| 实时聊天 | Client + WebSocket（Phase 3） |

### API Client 约定

```typescript
// lib/api/client.ts — 所有请求带 Client 标识（见 api-spec.md）
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function apiFetch<T>(
  path: `/api/v1/${string}`,
  init?: RequestInit
): Promise<SuccessResponse<T>> { /* ... */ }
```

- 响应类型从 `@orbitchat/shared-types` 导入
- 使用 `isSuccessResponse` / `isErrorResponse` 类型守卫

### 与 Hono 协作

- CORS：Hono 配置允许 Web origin（开发 `localhost:3000`）
- 认证：JWT 存 httpOnly cookie（Web）或 SecureStore（RN），Header 统一 `Authorization: Bearer`

## 相关

- [02-backend-framework.md](./02-backend-framework.md)
- [04-shared-packages.md](./04-shared-packages.md)
- [docs/api-spec.md](../api-spec.md)
