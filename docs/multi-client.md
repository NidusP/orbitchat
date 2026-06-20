# 多端客户端规范 - Orbitchat

## 概览

本文档定义 **Web、Orbitchat-rn（iOS/Android）、未来桌面端** 如何以统一方式访问 Hono API。

**读者**：前端/RN 开发者、API 实现者、AI Agent。  
**相关文档**：[api-spec.md](./api-spec.md)、[decisions/08-auth-strategy.md](./decisions/08-auth-strategy.md)

---

## 设计目标

| 目标 | 做法 |
|------|------|
| 契约一致 | 所有端消费同一 `/api/v1/*` + `shared-types` |
| 类型安全 | TS 端直接 import types；Flutter 走 OpenAPI codegen |
| 平台差异隔离 | Token 存储、推送、WebSocket 连接由各端实现，协议不变 |
| 可观测 | 请求带 `X-Client-Platform` / `X-Request-Id`，便于日志与排错 |

---

## 客户端标识

### 平台枚举（`ClientPlatform`）

```typescript
type ClientPlatform = 'web' | 'ios' | 'android' | 'desktop';
```

### 必填 Header（Phase 1 起）

| Header | 说明 | 示例 |
|--------|------|------|
| `X-Client-Platform` | 平台 | `web` |
| `X-Client-Version` | 客户端 semver | `1.2.0` |
| `X-Device-Id` | 设备唯一 ID（UUID，客户端生成并持久化） | `550e8400-...` |
| `Authorization` | 受保护路由：`Bearer <access_token>` | — |
| `X-Request-Id` | 可选，UUID，服务端可在响应头回显 | — |

**`X-Device-Id` 规则**：
- 首次启动生成 UUID v4，写入本地持久存储
- 卸载重装视为新设备（新 ID）
- 与认证 Session 绑定（见 ADR 08）

---

## API 基址

| 环境 | Web | 移动端 / 其他 |
|------|-----|---------------|
| 本地 | `NEXT_PUBLIC_API_URL=http://localhost:3001` | `API_BASE_URL` 同上 |
| 生产 | `https://api.orbitchat.example` | 相同域名 |

- Web **不**通过 Next.js Route Handler 代理业务 API（BFF 仅 SSR 特殊场景，见 ADR 03）
- 移动端直连 API 域名，无 CORS

---

## 认证与 Token（经典双 Token + Session）

> 完整策略见 [ADR 08](./decisions/08-auth-strategy.md)。此处为各端 **实现要点**。

### Token 类型

| Token | 有效期 | 存储 | 用途 |
|-------|--------|------|------|
| **Access Token** | ~15 分钟 | 内存 / 短期存储 | 每次 API 请求 |
| **Refresh Token** | ~30 天 | 安全持久存储 | 刷新 Access Token |

Access Token 为 JWT（含 `sub`、`sessionId`）；Refresh Token 为 opaque 字符串，服务端只存 hash。

### 各端存储最佳实践

| 平台 | Access Token | Refresh Token | Device ID |
|------|--------------|---------------|-----------|
| **Web** | 内存（React state / 闭包） | **httpOnly Secure Cookie**（`SameSite=Lax`） | `localStorage` 或 Cookie |
| **iOS (RN)** | 内存 | **Keychain** | AsyncStorage / Keychain |
| **Android (RN)** | 内存 | **EncryptedSharedPreferences / Keystore** | 同上 |
| **Desktop** | 内存 | OS 密钥链 | 本地文件 |

❌ Web 禁止把 Refresh Token 放 `localStorage`（XSS 风险）。  
❌ 禁止把 Access Token 放长期持久化。

**Web 端 Refresh 由服务端 `Set-Cookie` 写入**，浏览器自动保存；JS 不可读，但 refresh 请求会随 Cookie 发送（`credentials: 'include'`）。

### Web 长期登录（免密保持会话）

「7 天内打开网站仍保持登录」**与 httpOnly Cookie 完全兼容**——长期登录靠的是 **Refresh Token / Session 有效期**，不是把 Token 塞给 JavaScript。

```
用户登录成功
  → 服务端 Set-Cookie: refresh_token=...; HttpOnly; Secure; SameSite=Lax
  → 前端仅把 accessToken 放内存

用户关闭浏览器，7 天内再次访问
  → access 已过期
  → 应用启动或 API 401 → POST /api/v1/auth/refresh（Cookie 自动携带）
  → 获得新 accessToken → 用户无感，仍算已登录

Refresh 过期 / Session 被 revoke / 用户主动 logout
  → refresh 失败 → 跳转登录页
```

| 配置项 | 说明 |
|--------|------|
| Session `expires_at` | 如 7 天或 30 天，决定「免登录」最长多久 |
| Access 15min | 仅影响多久 refresh 一次，不影响「是否免密」 |
| 登录页「保持登录」 | 可选：勾选则延长 Session TTL |

### 登录流程

**Web**

```
1. POST /api/v1/auth/login（credentials: 'include'）
2. Response body: { accessToken, expiresIn, user, session }
3. Response Set-Cookie: refresh_token（httpOnly）← 第 3 步在 Web 上是 Cookie，不是 JS 存储
4. 前端把 accessToken 存内存；后续请求 Bearer accessToken
```

**RN / 移动端**

```
1. POST /api/v1/auth/login
2. Response body 含 refreshToken（或双 token）
3. refreshToken 写入 Keychain / Keystore
4. accessToken 存内存
```

### Token 刷新（401 统一处理）

```
API 返回 401 + code UNAUTHORIZED（access 过期）
  → POST /api/v1/auth/refresh（Refresh Token 随 Cookie 或 Body）
  → 获得新 accessToken（+ 可选 rotation 的新 refreshToken）
  → 重试原请求一次
  → 仍失败则跳转登录
```

**API Client 封装要求**（Web / RN 共用逻辑）：
- 单飞刷新（并发 401 只触发一次 refresh）
- 刷新失败 → 清本地凭证 → 导航至登录页

### 同端单点登录（SSO per platform）

策略：**同一用户在同一 `X-Client-Platform` 上仅保留一个活跃 Session**。

- 用户在 Chrome 登录 → 创建 `web` Session
- 同一用户在 Safari 再登录 → 旧 `web` Session 被 revoke，Safari 获得新 Session
- 用户 iPhone 登录不影响 Web；Web 与 `ios` 可同时在线

各端应在被服务端 revoke 时（refresh 返回 401）提示「您的账号已在其他设备登录」并清本地状态。

---

## 统一 API Client 模式

### 目录约定

```
apps/web/src/lib/api/          # Web client
apps/orbitchat-rn/src/lib/api/ # RN client（未来）
packages/shared-types/         # 类型 SSOT
```

### 推荐封装（伪代码）

```typescript
import type { ApiResponse, SuccessResponse } from '@orbitchat/shared-types';
import { isSuccessResponse } from '@orbitchat/shared-types';

const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
  'X-Client-Platform': 'web',
  'X-Client-Version': process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0',
  'X-Device-Id': getDeviceId(),
} as const;

export async function apiRequest<T>(
  path: `/api/v1/${string}`,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...DEFAULT_HEADERS, ...init?.headers },
    credentials: 'include', // Web：携带 refresh cookie
  });

  const body = (await res.json()) as ApiResponse<T>;

  if (!isSuccessResponse(body)) {
    throw new ApiError(body.code, body.message, res.status);
  }
  return body.data;
}
```

- 路径参数使用 template literal 类型约束 `/api/v1/...`
- 错误类型 `ApiError` 携带 `code`，UI 按 code 分支

---

## 错误处理约定

| code | 客户端行为 |
|------|------------|
| `VALIDATION_ERROR` | 展示字段级错误（`details`） |
| `UNAUTHORIZED` | 尝试 refresh；失败则登出 |
| `FORBIDDEN` | 提示无权限 |
| `NOT_FOUND` | 404 页面或 toast |
| `CONFLICT` | 提示冲突（如用户名已存在） |
| `SESSION_REVOKED` | 清凭证，提示会话已失效 |
| `INTERNAL_ERROR` | 通用错误 + 上报 `X-Request-Id` |

网络错误（无响应体）：区分超时 / 离线，支持重试按钮。

---

## 会话与设备管理 API（Phase 1）

用户可在「设置 → 设备与会话」管理在线终端（需 **信任设备**，见 ADR 08）：

```
GET    /api/v1/auth/sessions          # 当前用户所有 Session 列表
DELETE /api/v1/auth/sessions/:id      # 下线指定 Session（信任设备可用）
POST   /api/v1/auth/sessions/trust    # 将当前设备标记为信任设备
DELETE /api/v1/auth/logout            # 登出当前 Session
POST   /api/v1/auth/logout-all        # 登出除当前外所有 Session（信任设备）
```

---

## Flutter 路径（备选移动端）

TS 类型无法直接 import，标准做法：

1. Server 用 `@hono/zod-openapi` 生成 `openapi.yaml`
2. CI 校验 spec 与 `shared-types` 字段一致
3. Flutter 用 `openapi_generator` 生成 Dart models + API client
4. 字段命名与 `shared-types` 保持一致（camelCase JSON）

---

## 实时通道（Phase 3+）

文字聊天 / 音视频信令走 WebSocket，HTTP 仅负责 REST。  
协议详见 [realtime-spec.md](./realtime-spec.md)（随 Phase 3 迭代）。

连接时 Query / Header 携带：`access_token`（或 Sec-WebSocket-Protocol）、`X-Device-Id`。

---

## 版本与兼容

- API 版本由 URL `/api/v1` 控制
- 客户端 `X-Client-Version` 过旧时可返回 `426 Upgrade Required` + 最低版本（Phase 2+ 可选）
- 响应只增字段不删字段（见 api-spec 向后兼容）

---

## 检查清单（实现前）

- [ ] 所有 `/api/v1` 请求带 Platform / Version / Device-Id
- [ ] Web Refresh Token 在 httpOnly Cookie
- [ ] 401 自动 refresh + 单飞
- [ ] Session revoked 有用户可见提示
- [ ] 类型从 `@orbitchat/shared-types` 导入，无手写重复 interface

---

## 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| 0.1.0 | 2026-06-14 | 初始多端规范 |
| 0.1.1 | 2026-06-14 | Web 长期登录与 Cookie 流程说明 |
