# 实时通信规范 - Orbitchat

> **文档状态**：Living Document（活文档）  
> **当前版本**：0.1.0 骨架  
> **详细协议**：随 Phase 3 开发同步迭代；Phase 1–2 无需实现。

## 概览

Orbitchat 实时能力分两类：

| 类型 | 阶段 | 传输 | 用途 |
|------|------|------|------|
| **文字消息** | Phase 3 | WebSocket | 私聊、群聊 |
| **音视频信令** | Phase 4 | WebSocket + WebRTC | 通话建立、ICE、SDP |
| **Session 事件** | Phase 3 可选 | WebSocket | 多端踢下线通知 |

REST API 负责历史消息拉取、会话列表；实时推送走 WebSocket。

**相关**：[multi-client.md](./multi-client.md)、[api-spec.md](./api-spec.md)

---

## 连接

### 端点（规划）

```
WS /ws/v1/chat          # 文字聊天
WS /ws/v1/signaling     # WebRTC 信令（Phase 4）
```

### 握手

```
Query: ?token=<access_token>
Header: X-Device-Id, X-Client-Platform
```

- 服务端校验 JWT + Session 未 revoke
- 连接与用户 / Session 绑定，便于按 Session 推送 `session.revoked`

---

## 消息 Envelope（草案）

所有 WS 帧为 JSON 文本：

```typescript
interface WsMessage<T = unknown> {
  type: string;       // 事件类型，如 'message.new'
  payload: T;
  timestamp: string;  // ISO 8601
  requestId?: string; // 客户端关联用
}
```

### 命名约定

- 格式：`<domain>.<action>`，如 `message.new`、`message.read`、`session.revoked`
- 使用过去分词表示状态：`typing.started` / `typing.stopped`

---

## Phase 3 计划事件（占位）

| type | 方向 | 说明 |
|------|------|------|
| `message.new` | S→C | 新消息 |
| `message.ack` | C→S | 送达确认 |
| `message.read` | 双向 | 已读回执 |
| `typing.started` | C→S→C | 正在输入 |
| `presence.online` | S→C | 在线状态（可选） |
| `session.revoked` | S→C | 会话被踢 |

**Payload 结构**：Phase 3 开开发时在本文档补充完整 TypeScript 定义，并同步至 `shared-types`。

---

## 房间模型（占位）

- **1:1 聊天**：roomId = `conversationId`
- **群聊**：roomId = `groupId`；加入/离开通过 REST 管理成员，WS 仅推送

---

## 与 REST 分工

| 操作 | 通道 |
|------|------|
| 发送消息（可离线） | REST POST + WS 推送 |
| 拉取历史 | REST GET paginated |
| 实时送达 | WS |
| 创建群 / 邀请 | REST |

具体是否在 Phase 3 采用「REST 写入 + WS 广播」经典模式，实现前在此文档定稿。

---

## 技术选型（待 ADR）

Phase 3 启动前新增 ADR，候选：

- Hono 内置 WebSocket / `Bun.serve` ws
- Redis Pub/Sub（多实例时）

---

## 维护策略

1. **Phase 3 启动前**：定稿连接、envelope、核心事件列表
2. **每个 WS 事件实现时**：更新 payload 类型 + `shared-types`
3. **Phase 4 音视频**：新增 `signaling.*` 事件章节，不修改文字聊天章节

---

## 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| 0.1.0 | 2026-06-14 | 骨架与维护策略 |
