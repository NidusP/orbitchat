# ADR 14：消息写入与实时投递模型

- **状态**：Accepted
- **日期**：2026-07-03
- **阶段**：Phase 3A

## 背景

Phase 3A 需要实现 1:1 私聊：消息必须持久化，并在对方在线时实时送达。系统已有 `/api/v1/*` REST 契约、Postgres + Drizzle、统一 auth/session 机制。WebSocket 基础设施由 ADR 13 定义。

关键问题是：消息由 REST 写入，还是由 WebSocket 直接发送并写库？离线用户如何补齐？客户端如何处理重连与重复？

## 选项

### 1. REST 写入 + WebSocket 广播

客户端通过 REST 发送消息；服务端事务写入 Postgres；成功后通过 WebSocket 向会话成员广播 `message.new`。

- 优点：持久化路径清晰；可复用 REST 鉴权、Zod、错误 envelope；离线用户天然通过 REST 拉历史补齐；测试简单。
- 缺点：实时发送需要一次 HTTP 请求和一次 WS 广播；客户端要同时维护 REST 与 WS。

### 2. WebSocket 写入 + 广播

客户端通过 WS 发送 `message.send`；服务端写库后广播。

- 优点：单通道交互；实时语义直观。
- 缺点：WS 错误处理、重试、幂等、离线兜底都更复杂；需要为写操作重新定义 ACK 和失败语义。

### 3. 双写入口：REST 与 WS 都可发送

- 优点：灵活。
- 缺点：语义重复、幂等与权限逻辑分散；Phase 3A 过度设计。

## 决策

选择 **REST 写入 + WebSocket 广播**。

Phase 3A 发送消息流程：

```text
Client
  POST /api/v1/conversations/:id/messages
    ↓
Server
  1. 校验 JWT + Session
  2. 校验用户是 conversation member
  3. 校验 content 长度
  4. 写入 messages
  5. 更新 conversations.last_message_at
  6. 返回 Message
  7. 广播 WS message.new 给 room 成员
```

WebSocket 不承担消息持久化入口。3A 不实现 `message.send` C→S 事件。

## 投递语义

Phase 3A 提供 **at-least-once 可见性**，不承诺严格 exactly-once WS 投递：

- DB 写入成功即为消息事实来源。
- WS `message.new` 是实时提示和 UI 增量更新。
- 客户端重连或刷新后必须通过 REST 拉取历史，以 DB 为准。
- 客户端按 `message.id` 去重。

## 在线与离线

在线成员：

- 如果成员存在本机 WS 连接，服务端广播 `message.new`。
- 同一用户多连接（多 Tab / 多设备）都会收到事件。

离线成员：

- 不做推送，不做离线队列。
- 用户打开会话时通过 `GET /messages` 拉取历史。
- FCM / APNs 延后到 Phase 3.1。

## ACK 与已读

Phase 3A 简化：

- `message.ack` 可选，仅用于客户端调试或未来送达态，不作为消息事实来源。
- 已读使用 `conversation_members.last_read_at`，由 REST `PATCH /api/v1/conversations/:id/read` 或进入会话时更新。
- 不做逐条已读回执，不建 `message_reads` 表。

## 顺序与分页

消息顺序以 DB 字段为准：

```text
ORDER BY created_at DESC, id DESC
```

历史查询使用 cursor 分页，响应 `items + nextCursor`。UI 展示时可反转为时间正序。

## 幂等

Phase 3A 不强制客户端提供 `clientMessageId`。若后续发现弱网重试导致重复消息影响体验，可在 Phase 3.1 增加：

```text
client_message_id
UNIQUE(sender_id, client_message_id)
```

当前版本客户端应在 POST 请求未返回时避免自动重复提交。

## 错误处理

REST 错误使用现有 `ErrorResponse`：

| code | HTTP | 场景 |
|------|------|------|
| `UNAUTHORIZED` | 401 | 未登录或 Session 无效 |
| `FORBIDDEN` | 403 | 非会话成员 |
| `NOT_FOUND` | 404 | conversation 不存在 |
| `VALIDATION_ERROR` | 400 | 内容为空、超长、cursor 无效 |

WS 错误使用 `error` 帧，详见 `realtime-spec.md`。

## 原因

- 持久化优先，避免 WS 写入路径过早复杂化。
- REST 已有统一校验与错误处理。
- 离线用户只需 REST 补拉，无需离线消息队列。
- 与 Phase 2 的 REST-first 风格一致，WebSocket 只负责实时增量。

## 权衡

- 客户端需要同时实现 REST API 和 WS client。
- 发送后自己也会收到 `message.new`，客户端需按 `message.id` 去重或用返回值与事件合并。
- 弱网重试幂等在 3A 不完整，后续可加 `clientMessageId`。

## 后续

1. 在 `api-spec.md` 定义 conversations / messages REST 契约。
2. 在 `realtime-spec.md` 定义 `message.new`、`message.ack`、`message.read` 的 payload。
3. 实现 `message-service`：写入、分页、已读更新、WS 广播触发点。

## 相关

- [ADR 13 — WebSocket 栈与连接管理](./13-websocket-stack.md)
- [ADR 15 — 1:1 会话模型](./15-conversation-model.md)
- [api-spec.md](../api-spec.md)
- [realtime-spec.md](../realtime-spec.md)
