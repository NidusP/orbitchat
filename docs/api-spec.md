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

### 5. 接口健壮性

所有写操作须在 **Service 层**做权威校验（不依赖 UI）。原则与全量审计见：

- [ADR 18 — API 接口健壮性](./decisions/18-api-robustness.md)
- [api-robustness-audit.md](./api-robustness-audit.md)

摘要：资源存在 / 状态合法 / 权限 / 无意义操作拒绝 / 幂等语义文档化 / 并发条件更新。

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

### 写操作健壮性约定

与 [ADR 18](./decisions/18-api-robustness.md) 一致，全站统一：

| 场景 | 行为 |
|------|------|
| **PATCH 内容未变** | 所有提供的字段与当前值相同 → `VALIDATION_ERROR` 400（含用户资料、群名、帖子、消息） |
| **二次软删除** | 帖子、评论、消息撤回、邀请撤销等已删除/已撤回资源再次 `DELETE` → `VALIDATION_ERROR` 400 |
| **inactive 用户** | `is_active = false` 的账号在公开读 API 上等价于不存在 → `NOT_FOUND` 404（不暴露停用状态） |
| **协作编辑冲突** | 带 `expectedVersion` 的 PATCH；版本不匹配 → `CONFLICT` 409（见 [ADR 19](./decisions/19-concurrency-optimistic-pessimistic.md)） |

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

- **`GET /users/:id`**、**`GET /users/:id/profile`**、**`GET /users/:id/posts`**：`is_active = false` 返回 `NOT_FOUND` 404（与不存在用户相同）。
- **`PATCH /users/:id`**、**`PATCH /users/:id/profile`**：仅本人；所有请求字段与当前值相同 → `VALIDATION_ERROR` 400。

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

- **`DELETE /posts/:id`**、**`DELETE /posts/:id/comments/:commentId`**：已软删资源再次删除 → `VALIDATION_ERROR` 400。
- **`PATCH /posts/:id`**：内容未变 → `VALIDATION_ERROR` 400。

### Phase 3 — 文字聊天

> 设计依据：[ADR 13](./decisions/13-websocket-stack.md)、[ADR 14](./decisions/14-message-delivery.md)、[ADR 15](./decisions/15-conversation-model.md)、[ADR 16](./decisions/16-group-chat-model.md)

```
GET    /api/v1/conversations                        # 当前用户会话列表；cursor 分页
POST   /api/v1/conversations                        # 创建 1:1 或群聊
GET    /api/v1/conversations/:id                    # 获取单个会话
PATCH  /api/v1/conversations/:id                    # 修改群名（仅 group；owner/admin）
GET    /api/v1/conversations/:id/messages             # 历史消息；cursor 分页
POST   /api/v1/conversations/:id/messages           # 发送消息：REST 写库 + WS 广播
PATCH  /api/v1/conversations/:id/messages/:messageId # 编辑自己发送的消息（15 分钟内）
GET    /api/v1/conversations/:id/messages/:messageId/edits # 编辑历史
DELETE /api/v1/conversations/:id/messages/:messageId # 撤回消息（3 分钟内；软删除 + 系统 recall 事件）
PATCH  /api/v1/conversations/:id/read                 # 标记会话已读（last_read_at）
GET    /api/v1/conversations/:id/members            # 群成员列表（仅 group）
POST   /api/v1/conversations/:id/members            # 拉人入群（owner/admin）
PATCH  /api/v1/conversations/:id/members/:userId    # 改成员角色 admin/member（owner）
DELETE /api/v1/conversations/:id/members/:userId    # 踢人（owner/admin）
POST   /api/v1/conversations/:id/leave              # 退群（非 owner）
POST   /api/v1/conversations/:id/transfer-owner     # 转让群主（owner）
POST   /api/v1/conversations/:id/invites            # 创建邀请链接（owner/admin）
GET    /api/v1/conversations/:id/invites            # 邀请链接列表（owner/admin）
DELETE /api/v1/conversations/invites/:code          # 撤销邀请链接（owner/admin）
GET    /api/v1/conversations/invites/:code          # 邀请预览（登录）
POST   /api/v1/conversations/invites/:code/accept   # 接受邀请并入群
WS     /ws/v1/chat                                  # 实时消息、typing（仅 1:1）、成员变更
```

Phase 3A：1:1 私聊。Phase 3B：群聊创建与基础消息。Phase 3B.1：群管理（角色、拉人/踢人/退群/改名/转让）+ **1:1 typing**（群聊不做 typing）。移动推送延后 Phase 3.1。

补充：
- 消息编辑/撤回只允许发送者本人；**撤回**为软删除（`deletedAt`），并写入 `message_recalls` 系统事件（**不是** `messages` 行，不计入未读/会话预览）。
- **撤回窗口 3 分钟**；**编辑窗口 15 分钟**。编辑不广播 WS；撤回广播 `message.recalled`。
- 编辑时内容未变化 → `VALIDATION_ERROR`；已撤回消息不可再次撤回或编辑 → `VALIDATION_ERROR`。
- 编辑历史：`GET .../messages/:messageId/edits` → `message_edits` 表；UI 显示「已编辑」可查看历史。
- 邀请链接支持过期、最大使用次数、撤销；`accept` 对已在群内用户幂等返回 200。
- **`DELETE /conversations/invites/:code`**：已撤销的邀请再次撤销 → `VALIDATION_ERROR` 400。
- **`PATCH /conversations/:id`**（群名 / 公告）：提供字段均未变 → `VALIDATION_ERROR` 400；`expectedVersion` 过期 → `CONFLICT` 409。群名与公告共享同一 `version`。

#### 数据类型（概要）

```typescript
interface ConversationParticipant {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

type GroupMemberRole = 'owner' | 'admin' | 'member';

interface GroupMember extends ConversationParticipant {
  role: GroupMemberRole;
  joinedAt: string;
}

interface Conversation {
  id: string;
  type: 'direct' | 'group';
  title: string | null;
  announcement: string | null; // 仅 group 使用；direct 恒为 null
  participants: ConversationParticipant[];
  viewerRole: GroupMemberRole | null; // group 时当前用户角色；direct 为 null
  lastMessage: Message | null;
  lastMessageAt: string | null;
  unreadCount: number;
  version: number; // metadata_version；协作 PATCH 用 expectedVersion 对齐
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

创建或获取会话。

**1:1 私聊**（兼容 Phase 3A）：若两名用户已有 direct conversation，返回既有会话。

Request：

```typescript
interface CreateDirectConversationRequest {
  participantUserId: string;
}
```

**群聊**（Phase 3B）：创建新群；创建者自动加入成员列表。

Request：

```typescript
interface CreateGroupConversationRequest {
  type: 'group';
  title: string; // 1..120 chars
  memberUserIds: string[]; // 至少 1 名其他成员（不含创建者），最多 49
}
```

Response 201 / 200：

```typescript
SuccessResponse<Conversation>
```

`Conversation` 在群聊时 `type: 'group'`，`title` 为群名称；私聊时 `title` 为 `null`。

错误：

| code | HTTP | 场景 |
|------|------|------|
| `VALIDATION_ERROR` | 400 | 参数无效；1:1 时 `participantUserId` 等于当前用户；群聊无其他成员 |
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

#### `PATCH /api/v1/conversations/:id`

修改群 **元数据**（群名 / 公告）。仅 `type=group`；需要 **owner** 或 **admin**。`title` 与 `announcement` 至少提供一个，二者共享同一 `version`（协作编辑乐观锁）。

Request：

```typescript
interface UpdateGroupConversationRequest {
  title?: string;              // 1..120 chars after trim
  announcement?: string | null; // 0..1000 chars；null 或空串表示清空
  expectedVersion: number;      // 来自 Conversation.version；协作编辑乐观锁
}
```

Response：

```typescript
SuccessResponse<Conversation>
```

错误：

| code | HTTP | 场景 |
|------|------|------|
| `VALIDATION_ERROR` | 400 | 非群会话、未提供任何字段、**提供的字段均未变** |
| `CONFLICT` | 409 | **`expectedVersion` 与当前 `version` 不一致**（其他管理员已修改） |
| `FORBIDDEN` | 403 | 非成员或权限不足 |
| `NOT_FOUND` | 404 | 群不存在 |

#### `GET /api/v1/conversations/:id/members`

返回群成员列表（含 `role`、`joinedAt`）。仅 `type=group`；任意活跃成员可读。

Response：

```typescript
SuccessResponse<GroupMember[]>
```

#### `POST /api/v1/conversations/:id/members`

拉人入群。需要 **owner** 或 **admin**。

Request：

```typescript
interface AddGroupMembersRequest {
  userIds: string[]; // 至少 1 个 UUID；去重；不含操作者本人
}
```

Response：

```typescript
SuccessResponse<GroupMember[]>
```

行为：目标用户须存在；已在群内则跳过；曾离开的成员复用 membership 行并清空 `left_at`。成功后 WS 广播 `member.joined`（见 [realtime-spec](./realtime-spec.md)）。

错误：

| code | HTTP | 场景 |
|------|------|------|
| `VALIDATION_ERROR` | 400 | `userIds` 为空 |
| `FORBIDDEN` | 403 | 非 owner/admin |
| `NOT_FOUND` | 404 | 群不存在或用户不存在 |

#### `DELETE /api/v1/conversations/:id/members/:userId`

踢出成员。需要 **owner** 或 **admin**；**admin 不能踢 owner 或其他 admin**；不能踢自己（应使用 `leave`）。

Response：

```typescript
SuccessResponse<{ ok: true }>
```

成功后 WS 广播 `member.left`（`reason: 'kicked'`）。

#### `PATCH /api/v1/conversations/:id/members/:userId`

修改成员角色。仅 **owner** 可操作；不能把 owner 直接改为 admin/member（须先 `transfer-owner`）。

Request：

```typescript
interface UpdateGroupMemberRoleRequest {
  role: 'admin' | 'member';
}
```

Response：

```typescript
SuccessResponse<GroupMember[]>
```

#### `POST /api/v1/conversations/:id/leave`

当前用户退群。**owner** 须先转让群主，否则 `VALIDATION_ERROR`。

Response：

```typescript
SuccessResponse<{ ok: true }>
```

成功后 WS 广播 `member.left`（`reason: 'left'`）。

#### `POST /api/v1/conversations/:id/transfer-owner`

转让群主。仅当前 **owner** 可操作；不能转让给自己。

Request：

```typescript
interface TransferGroupOwnerRequest {
  newOwnerUserId: string;
}
```

Response：

```typescript
SuccessResponse<GroupMember[]>
```

行为：原 owner → `admin`，新 owner → `owner`。

#### WebSocket — 1:1 Typing

Typing **不走 REST**，仅通过 `WS /ws/v1/chat`。**仅 direct 会话**；群聊发送 typing 帧返回 `VALIDATION_ERROR`。

客户端发送（payload 只需 `conversationId`）：

```typescript
// C → S
{ type: 'typing.started' | 'typing.stopped', payload: { conversationId: string }, timestamp: string }
```

服务端向**对方**广播（排除发送者）：

```typescript
interface TypingPayload {
  conversationId: string;
  userId: string;
  displayName: string;
}
```

详见 [realtime-spec.md](./realtime-spec.md)。

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
GET    /api/v1/ai/memories                    # 当前用户 AI 记忆列表（非软删，默认 limit 50）
POST   /api/v1/ai/memories                    # 用户手动添加 AI 记忆
DELETE /api/v1/ai/memories/:id                # 软删 AI 记忆（非本人或已删 → 404）
```

Phase 4B 通过 LLM Function Calling 选择工具；写操作（`send_dm`、`create_post`、`follow_user`、`unfollow_user`、`remember_fact`）创建 pending tool call，用户 Approve 后复用对应 service 执行。

**只读 / 娱乐工具**（与 `search_contact` 相同，**立即执行**，无需 Approve）：

| Tool | 参数 | 行为 |
|------|------|------|
| `search_contact` | `query`（必填） | 按 username / displayName 搜索用户 |
| `get_my_profile` | — | 返回当前登录用户的 `users` + `profiles` 公开资料 |
| `list_my_recent_posts` | `limit`（可选，1–20，默认 5） | 按时间倒序返回本人最近帖子（cursor/limit 语义同 Feed） |
| `search_my_posts` | `query`（必填）；`limit`（可选，1–10，默认 5） | 语义检索本人帖子 Top-K，返回 `postId`、文本片段、`score` |
| `search_help_docs` | `query`（必填）；`limit`（可选，1–10，默认 5） | 检索 Orbitchat 帮助/产品文档，返回 `sourceId`、片段、`score` |
| `get_user_profile` | `username`（必填） | 返回指定用户的公开 profile；规则同 `GET /users/:id` |
| `list_user_recent_posts` | `username`（必填）；`limit`（可选，1–20） | 返回指定用户公开帖；inactive 用户 → 404 语义 |
| `play_tictactoe` | 见下 | 井字棋对局 |

**写操作 / 需 Approve 工具**（创建 pending tool call，用户确认后执行）：

| Tool | 参数 | 行为 |
|------|------|------|
| `send_dm` | `target_username`（必填）；`content`（必填） | 向指定用户发送私信 |
| `create_post` | `content`（必填，1–2000 字符） | 发布 Feed 帖子 |
| `follow_user` | `target_username`（必填） | 关注用户 |
| `unfollow_user` | `target_username`（必填） | 取消关注 |
| `remember_fact` | `kind`（必填：`preference` \| `fact` \| `nickname`）；`content`（必填，1–500 字符） | 保存用户事实到长期记忆；Approve 后写入 `user_agent_memories`（`source=tool`） |

Wave 2 记忆注入：`createAiMessageAndRun` 前加载当前用户最近 8 条未删除记忆，拼入 orchestrator system prompt（`## 关于该用户的已知事实（用户可删除）`）。

Wave 1 只读工具复用现有 `user-service` / `post-service` / `feed-service`；Agent 须依据工具返回回答，禁止编造帖子标题、粉丝数等站内数据。

`play_tictactoe` 参数：`action` = `start` | `status` | `move`；`move` 时需 `position`（1–9）。用户执 X，Agent 执 O；工具返回 `game.board`、`game.boardVisual`、`game.legalMoves` 等状态，Agent 须依据工具结果落子，不可臆造棋盘。对局结束后用户可说「再来一局」，Agent 调用 `start` 开局；`start` 在存在历史时返回 `matchHistory`（胜负统计与最近若干局），Agent 须据此自由发挥点评，不使用固定话术。对局状态持久化在 `ai_conversations.tictactoe_data`（当前盘 + 历史），同一会话内跨重启保留。

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

interface UserAgentMemory {
  id: string;
  userId: string;
  agentId: string | null;
  kind: 'preference' | 'fact' | 'nickname';
  content: string;
  source: 'user_explicit' | 'tool' | 'admin';
  conversationId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}
```

#### `GET /api/v1/ai/memories`

Query：`limit`（可选，1–50，默认 50）。返回当前用户未软删记忆，按 `createdAt` 降序。

Response 200：`SuccessResponse<UserAgentMemory[]>`。

#### `POST /api/v1/ai/memories`

Request：

```typescript
interface CreateUserAgentMemoryRequest {
  kind: 'preference' | 'fact' | 'nickname';
  content: string; // 1..500 chars after trim
}
```

Response 201：`SuccessResponse<UserAgentMemory>`。`source` 固定为 `user_explicit`。

#### `DELETE /api/v1/ai/memories/:id`

软删指定记忆。非本人或已删 → 404 `NOT_FOUND`。

Response 200：`SuccessResponse<{ success: true }>`。

#### `POST /api/v1/ai/conversations/:id/messages`

Request：

```typescript
interface CreateAiMessageRequest {
  content: string; // 1..4000 chars after trim
}
```

**可预判错误（Phase A）**：在打开 SSE 流**之前**返回 JSON `ErrorResponse`（与 §2 统一信封一致），客户端应检查 `!response.ok` 并用 `parseApiError` 解析，而非等待 SSE 事件。典型场景：

| HTTP | `code` | 场景 |
|------|--------|------|
| 400 | `VALIDATION_ERROR` | 请求体 Zod 校验失败（middleware，已有） |
| 404 | `NOT_FOUND` | AI 会话不存在或非当前用户 |
| 429 | `AI_BUSY` | 同会话已有进行中的 AI 请求 |

**成功路径** Response：`text/event-stream`。每个 SSE 数据行均为 `AiSseEvent` JSON，**事件级**含 `timestamp`（ISO 8601，与 `SuccessResponse` / `ErrorResponse` 一致）。

```typescript
type AiSseEvent =
  | { type: 'run.started'; payload: { conversationId: string }; timestamp: string }
  | { type: 'tool.started'; payload: { conversationId: string; toolName: string; input: unknown }; timestamp: string }
  | { type: 'message.delta'; payload: { conversationId: string; messageId: string; delta: string }; timestamp: string }
  | { type: 'tool.call'; payload: { conversationId: string; toolName: string; input: unknown; output: unknown }; timestamp: string }
  | { type: 'message.done'; payload: { conversationId: string; message: AiMessage }; timestamp: string }
  | { type: 'error'; payload: { code: string; message: string; details?: unknown }; timestamp: string };
```

| 事件 | 阶段 | 含义 |
|------|------|------|
| `run.started` | A | 连接已建立，服务端开始处理（首条 SSE 事件） |
| `tool.started` | C | 即将执行某 tool（进度提示） |
| `message.delta` | B | LLM 文本增量（Phase 4A 为假流式切块；Phase B 为真 token/chunk） |
| `tool.call` | 已有 | tool 执行完成（含 `input` / `output`） |
| `message.done` | 已有 | 本轮结束，assistant 消息已落库 |
| `error` | A | 运行中失败；`payload` 字段对齐 `ErrorResponse`（`code`、`message`、可选 `details`），`timestamp` 在事件级 |

客户端应以 `message.done` 作为本轮回复持久化完成信号。运行中失败（如本地模型不可用）走 SSE `error` 事件并结束流；可预判错误见上表 JSON 路径。详见 [ADR 20](./decisions/20-ai-sse-streaming.md)。

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
