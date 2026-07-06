# API 规范 - Orbitchat

## 概览

本文档定义 Orbitchat **多端共享**的 HTTP API 契约，是 `shared-types` 与实现的 Spec 来源。

**当前阶段**：Phase 2 API 已实现；Phase 3A 私聊 API 为编码前契约草案。

**相关 ADR**：[02-backend-framework.md](./decisions/02-backend-framework.md)、[04-shared-packages.md](./decisions/04-shared-packages.md)、[08-auth-strategy.md](./decisions/08-auth-strategy.md)

**多端实现**：[multi-client.md](./multi-client.md)

---

## URL 与版本约定

| 类型 | 前缀 | 响应格式 |
|------|------|----------|
| **基础设施** | `/health` | 简单 JSON，**无** envelope |
| **业务 API** | `/api/v1/*` | 统一 `SuccessResponse` / `ErrorResponse` |
| **WebSocket** | `/ws/v1/*` | Phase 3+ 单独 spec（聊天/信令） |

- 当前版本：**v1**
- 所有新业务端点 **必须** 使用 `/api/v1/`，禁止无版本前缀的 `/api/*`
- 破坏性变更通过 `/api/v2` 新前缀发布，v1 保持兼容

---

## 多端请求规范

所有 `/api/v1/*` 请求应携带以下 Header（Phase 1 起强制）：

| Header | 必填 | 示例 | 说明 |
|--------|------|------|------|
| `Authorization` | 受保护路由 | `Bearer <jwt>` | JWT 认证 |
| `Content-Type` | 有 body 时 | `application/json` | 仅支持 JSON |
| `Accept` | 推荐 | `application/json` | |
| `X-Client-Platform` | Phase 1+ | `web` / `ios` / `android` / `desktop` | 客户端平台 |
| `X-Client-Version` | Phase 1+ | `1.0.0` | 客户端 semver |
| `X-Device-Id` | Phase 1+ | UUID | 设备 ID，绑定 Session（见 multi-client.md） |
| `X-Request-Id` | 推荐 | UUID | 链路追踪，服务端可回显 |

服务端应：
- 校验 `Content-Type` 与 body schema（Hono + `@hono/zod-validator`）
- 在日志中记录 `X-Client-Platform` / `X-Request-Id`
- CORS 允许 Web origin；移动端无 CORS，依赖 Token

---

## API 设计原则

### 1. RESTful 风格

- HTTP 方法表达语义（GET、POST、PUT、PATCH、DELETE）
- 资源导向 URL，无动词路径（`/login` 除外，认证端点惯例保留）
- 无状态请求-响应

### 2. 统一响应格式（`/api/v1/*`）

类型定义：`packages/shared-types/src/api/response.ts`

```typescript
interface SuccessResponse<T> {
  code: 'SUCCESS';
  data: T;
  timestamp: string;  // ISO 8601
}

interface ErrorResponse {
  code: string;
  message: string;
  details?: unknown;
  timestamp: string;
}
```

### 3. HTTP 状态码

| 状态码 | 含义 | 场景 |
|--------|------|------|
| 200 | OK | 请求成功 |
| 201 | Created | 资源创建成功 |
| 400 | Bad Request | 参数验证失败 |
| 401 | Unauthorized | 未认证 |
| 403 | Forbidden | 无权限 |
| 404 | Not Found | 资源不存在 |
| 409 | Conflict | 资源冲突 |
| 422 | Unprocessable Entity | 语义错误（可选） |
| 500 | Internal Server Error | 服务器错误 |

### 4. 分页

查询参数：`page`（从 1 开始）、`limit`（默认 20，最大 100）

```typescript
interface PaginatedResponse<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  hasNextPage: boolean;
}
```

列表成功响应：`SuccessResponse<PaginatedResponse<T>>`

---

## 数据契约

### SSOT

- 所有跨端类型定义在 `@orbitchat/shared-types`
- Phase 1 起：Zod schema（server）与 shared-types 字段保持一致
- Phase 2 起：`@hono/zod-openapi` 生成 OpenAPI，供 Flutter codegen

### 时间与 ID

- 时间：ISO 8601 字符串（API 层），如 `2026-06-14T10:00:00.000Z`
- ID：UUID v4 字符串

```typescript
interface EntityTimestamps {
  id: string;
  createdAt: string;
  updatedAt: string;
}
```

---

## 错误处理

### 错误代码

| code | HTTP | 说明 |
|------|------|------|
| `VALIDATION_ERROR` | 400 | 参数验证失败 |
| `UNAUTHORIZED` | 401 | 未登录或 Token 无效 |
| `FORBIDDEN` | 403 | 无权限 |
| `NOT_FOUND` | 404 | 资源不存在 |
| `CONFLICT` | 409 | 重复注册等 |
| `INTERNAL_ERROR` | 500 | 未预期错误 |

### 示例

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Invalid email format",
  "details": { "field": "email" },
  "timestamp": "2026-06-14T10:00:00.000Z"
}
```

Hono 实现：`AppError` + `app.onError` / `app.notFound` 统一输出 `ErrorResponse`。

---

## 认证

```
Authorization: Bearer <access_token>
```

```typescript
interface JWTPayload {
  sub: string;    // user id
  email: string;
  iat: number;
  exp: number;
}
```

- Web：优先 httpOnly Cookie（Phase 1 决策见 ADR 08-auth-strategy，待写）
- Orbitchat-rn：SecureStore 存 refresh token，内存/Keychain 存 access token

---

## 端点规划

### 当前已实现

```
GET /health          # 基础设施探针，无 envelope
GET /                # API 元信息（开发用）
```

**`/health` 响应**（与业务 API 不同，便于 K8s/负载均衡探针）：

```json
{
  "status": "ok",
  "timestamp": "2026-06-14T10:00:00.000Z",
  "version": "0.0.1"
}
```

### Phase 1 — 用户与认证

```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
DELETE /api/v1/auth/logout              # 当前 Session
POST   /api/v1/auth/logout-all          # 需信任设备
GET    /api/v1/auth/sessions            # Session 列表
DELETE /api/v1/auth/sessions/:sessionId # 下线指定 Session
POST   /api/v1/auth/sessions/trust      # 标记当前设备为信任
GET    /api/v1/users/:id
PATCH  /api/v1/users/:id
GET    /api/v1/users/:id/profile
PATCH  /api/v1/users/:id/profile
```

详见 [multi-client.md](./multi-client.md) 与 [ADR 08](./decisions/08-auth-strategy.md)。

### Phase 2 — 动态与社交

> 设计依据：[ADR 10](./decisions/10-social-content-storage.md)、[ADR 11](./decisions/11-feed-timeline-strategy.md)、[ADR 12](./decisions/12-phase2-client-sync.md)

```
GET    /api/v1/feed/home                 # 首页时间线（关注 + 自己）；cursor 分页
GET    /api/v1/users/:id/posts           # 用户主页动态；cursor 分页
POST   /api/v1/posts
GET    /api/v1/posts/:id
PATCH  /api/v1/posts/:id                 # 仅作者
DELETE /api/v1/posts/:id                 # 软删除；仅作者
POST   /api/v1/posts/:id/like
DELETE /api/v1/posts/:id/like
GET    /api/v1/posts/:id/comments        # cursor 分页
POST   /api/v1/posts/:id/comments
DELETE /api/v1/comments/:id            # 软删除；作者或帖主
POST   /api/v1/users/:id/follow
DELETE /api/v1/users/:id/follow
GET    /api/v1/users/:id/followers       # cursor 分页
GET    /api/v1/users/:id/following       # cursor 分页
GET    /api/v1/users/search              # ?q=&cursor=&limit=
```

**分页**：`cursor` + `limit`（默认 20，最大 50）；响应 `data.items` + `data.nextCursor`（具体信封以实现时 `shared-types` 为准）。

### Phase 3 — 文字聊天

> 设计依据：[ADR 13](./decisions/13-websocket-stack.md)、[ADR 14](./decisions/14-message-delivery.md)、[ADR 15](./decisions/15-conversation-model.md)

```
GET    /api/v1/conversations                  # 当前用户会话列表；cursor 分页
POST   /api/v1/conversations                  # 创建或获取 1:1 会话
GET    /api/v1/conversations/:id              # 获取单个会话
GET    /api/v1/conversations/:id/messages     # 历史消息；cursor 分页
POST   /api/v1/conversations/:id/messages     # 发送消息：REST 写库 + WS 广播
PATCH  /api/v1/conversations/:id/read         # 标记会话已读（last_read_at）
WS     /ws/v1/chat                            # 实时消息增量
```

Phase 3A 只实现 1:1 私聊。群聊端点延后 Phase 3B；移动推送延后 Phase 3.1。

#### 数据类型（概要）

```typescript
interface ConversationParticipant {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

interface Conversation {
  id: string;
  type: 'direct';
  participants: ConversationParticipant[];
  lastMessage: Message | null;
  lastMessageAt: string | null;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

interface Message {
  id: string;
  conversationId: string;
  sender: ConversationParticipant;
  content: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
}
```

#### `GET /api/v1/conversations`

返回当前用户参与的会话，按 `lastMessageAt DESC` 排序。

Query：

| 参数 | 必填 | 说明 |
|------|------|------|
| `cursor` | 否 | cursor 分页 |
| `limit` | 否 | 默认 20，最大 50 |

Response：

```typescript
SuccessResponse<{
  items: Conversation[];
  nextCursor: string | null;
}>
```

#### `POST /api/v1/conversations`

创建或获取 1:1 会话。若两名用户已有 direct conversation，返回既有会话。

Request：

```typescript
interface CreateConversationRequest {
  participantUserId: string;
}
```

Response 201 / 200：

```typescript
SuccessResponse<Conversation>
```

错误：

| code | HTTP | 场景 |
|------|------|------|
| `VALIDATION_ERROR` | 400 | `participantUserId` 无效或等于当前用户 |
| `NOT_FOUND` | 404 | 目标用户不存在 |
| `FORBIDDEN` | 403 | 后续 blocks 接入后被限制 |

#### `GET /api/v1/conversations/:id`

返回当前用户参与的单个会话；未加入该会话时返回 `FORBIDDEN`。

Response：

```typescript
SuccessResponse<Conversation>
```

#### `GET /api/v1/conversations/:id/messages`

拉取历史消息。DB 排序为倒序，客户端可按 UI 需要反转展示。

Query：

| 参数 | 必填 | 说明 |
|------|------|------|
| `cursor` | 否 | cursor 分页；基于 `createdAt + id` |
| `limit` | 否 | 默认 30，最大 50 |

Response：

```typescript
SuccessResponse<{
  items: Message[];
  nextCursor: string | null;
}>
```

#### `POST /api/v1/conversations/:id/messages`

发送纯文字消息。服务端写入 DB 成功后广播 `message.new`。

Request：

```typescript
interface CreateMessageRequest {
  content: string; // 1..2000 chars after trim
}
```

Response 201：

```typescript
SuccessResponse<Message>
```

错误：

| code | HTTP | 场景 |
|------|------|------|
| `VALIDATION_ERROR` | 400 | 空消息、超长、conversation id 无效 |
| `FORBIDDEN` | 403 | 当前用户不是会话成员 |
| `NOT_FOUND` | 404 | 会话不存在 |

#### `PATCH /api/v1/conversations/:id/read`

标记会话已读，更新当前用户 membership 的 `lastReadAt`。Phase 3A 不做逐条 read receipt。

Request：

```typescript
interface MarkConversationReadRequest {
  readAt?: string; // ISO 8601；默认服务端当前时间
}
```

Response：

```typescript
SuccessResponse<{
  conversationId: string;
  lastReadAt: string;
}>
```

### Phase 4A — AI Chat MVP

```
GET    /api/v1/ai/agents                    # 内置 Agent 列表
GET    /api/v1/ai/conversations             # 当前用户 AI 会话列表；cursor 分页
POST   /api/v1/ai/conversations             # 创建 AI 会话
GET    /api/v1/ai/conversations/:id/messages # AI 历史消息；cursor 分页
POST   /api/v1/ai/conversations/:id/messages # 发送用户消息；SSE 流式返回 assistant 回复
GET    /api/v1/ai/conversations/:id/tool-calls # AI tool call 审计列表
POST   /api/v1/ai/tool-calls/:id/approve      # 用户确认并执行 pending tool call
POST   /api/v1/ai/tool-calls/:id/reject       # 用户拒绝 pending tool call
```

Phase 4A 不直接执行 `send_dm`；Phase 4B 通过 pending tool call + 用户确认后，复用 Phase 3A `message-service` 发私聊。

#### 数据类型（概要）

```typescript
interface Agent {
  id: string;
  slug: string;
  name: string;
  description: string;
  systemPrompt: string;
  isBuiltin: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AiConversation {
  id: string;
  userId: string;
  agentId: string;
  title: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AiMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolName: string | null;
  createdAt: string;
}
```

#### `POST /api/v1/ai/conversations/:id/messages`

Request：

```typescript
interface CreateAiMessageRequest {
  content: string; // 1..4000 chars after trim
}
```

Response：`text/event-stream`

```typescript
type AiSseEvent =
  | { type: 'message.delta'; payload: { conversationId: string; messageId: string; delta: string } }
  | { type: 'tool.call'; payload: { conversationId: string; toolName: string; input: unknown; output: unknown } }
  | { type: 'message.done'; payload: { conversationId: string; message: AiMessage } }
  | { type: 'error'; payload: { code: string; message: string } };
```

客户端应以 `message.done` 作为本轮回复持久化完成信号。若本地模型服务不可用，服务端返回 `error` SSE 事件并结束流。

### Phase 4B+ — 预留

```
POST   /api/v1/calls                   # 发起通话（信令）
WS     /ws/v1/signaling                # WebRTC 信令
GET    /api/v1/storefront/products     # 橱窗（可能代理至 Go 服务）
```

---

## 示例：业务 API

```
GET /api/v1/users/550e8400-e29b-41d4-a716-446655440000

Request Headers:
  Authorization: Bearer <token>
  X-Client-Platform: web
  X-Client-Version: 0.1.0

Response 200:
{
  "code": "SUCCESS",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "username": "john_doe",
    "email": "john@example.com",
    "createdAt": "2026-01-15T10:30:00.000Z",
    "updatedAt": "2026-06-14T10:00:00.000Z"
  },
  "timestamp": "2026-06-14T10:00:00.000Z"
}

Response 404:
{
  "code": "NOT_FOUND",
  "message": "User not found",
  "timestamp": "2026-06-14T10:00:00.000Z"
}
```

---

## Hono 实现约定

```typescript
// apps/server/src/routes/v1/users.ts
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';

export const usersRouter = new Hono();

// apps/server/src/index.ts
// app.route('/api/v1/users', usersRouter);
```

- 路由按域拆分，在 `index.ts` 挂载到 `/api/v1/*`
- 验证：`@hono/zod-validator` + Zod
- 类型：handler 返回 `SuccessResponse<T>`，与 shared-types 对齐

---

## 维护流程

1. 更新本文档端点说明
2. 更新 `shared-types/src/api/v1/*`
3. 实现 Hono route
4. Phase 2+：OpenAPI 自动生成并与文档 diff 校验

---

## 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| 0.0.1 | 2024-06-09 | 初始框架 |
| 0.0.2 | 2026-06-14 | 统一 `/api/v1`、多端 Header、端点分阶段规划 |
