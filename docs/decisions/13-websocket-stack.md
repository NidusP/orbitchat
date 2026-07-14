# ADR 13：WebSocket 栈与连接管理

- **状态**：Accepted
- **日期**：2026-07-03
- **阶段**：Phase 3A

## 背景

Phase 3A 需要实现 1:1 私聊的实时送达：用户在 Web 端发送消息后，另一端应在 1 秒内收到 `message.new`。现有后端是 Bun + Hono 单体，`apps/server/src/index.ts` 通过 `Bun.serve` 暴露 HTTP API。ADR 02 已明确 Phase 0-3 主 API 服务选择 Bun + Hono，并预留 WebSocket 能力。

Phase 3A 的目标是建立可理解、可测试、可扩展的实时基础设施，不一次性解决多实例、presence、typing、推送、直播等问题。

## 选项

### 1. Bun.serve + Hono WebSocket adapter

- 优点：与当前运行时一致；无需引入新的协议框架；可复用 Hono auth / middleware 习惯；适合学习项目。
- 缺点：Bun WS 生产经验少于 Node 生态；多实例广播需后续自建 Redis Pub/Sub。

### 2. Socket.IO

- 优点：成熟；自带房间、重连、fallback、生态丰富。
- 缺点：不是标准裸 WebSocket 协议；客户端协议更重；移动端和未来多端需要额外适配；对当前需求偏重。

### 3. Node `ws` / uWebSockets.js

- 优点：资料多，性能成熟。
- 缺点：偏离当前 Bun-first 运行时；需要额外封装与 Hono 集成；学习路径分散。

## 决策

Phase 3A 选择 **Bun.serve + Hono WebSocket adapter**。

实现形态：

```text
apps/server/src/
├── index.ts                 # Bun.serve 同时挂 HTTP fetch 与 websocket
├── routes/v1/*              # REST API
└── realtime/
    ├── chat-hub.ts          # 连接 / 房间 / 广播
    ├── ws-auth.ts           # JWT + Session 握手校验
    └── ws-types.ts          # WS frame / meta 类型
```

Phase 3A 只提供：

```text
WS /ws/v1/chat
```

Phase 4C 再新增：

```text
WS /ws/v1/signaling
```

## 连接模型

一个 server 进程内只有一个 WebSocket upgrade 入口和一个 `ChatHub`，不是每个房间一个 WebSocket server 实例。

```text
Bun.serve
  ├── HTTP /api/v1/*
  └── WS /ws/v1/chat
        └── ChatHub
              ├── connections
              ├── users
              ├── sessions
              └── rooms
```

连接以 `connectionId` 为最小单位，以 `sessionId` 为鉴权和踢下线边界：

```typescript
interface ConnectionMeta {
  connectionId: string;
  userId: string;
  sessionId: string;
  deviceId: string;
  platform: 'web' | 'ios' | 'android' | 'desktop';
  joinedRooms: Set<string>;
  lastSeenAt: Date;
}
```

Hub 维护内存索引：

```text
connectionsById      Map<connectionId, socket>
metaByConnectionId   Map<connectionId, ConnectionMeta>
connectionsByUserId  Map<userId, Set<connectionId>>
connectionsBySession Map<sessionId, Set<connectionId>>
connectionsByRoomId  Map<roomId, Set<connectionId>>
```

允许同一 Session 下多个连接（例如 Web 多 Tab）。如果 Session 被 revoke，服务端通过 `connectionsBySession` 关闭该 Session 下所有连接。

## 房间模型

Phase 3A：

```text
roomId = conversation:{conversationId}
```

Phase 3B：

```text
roomId = group:{groupId}
```

Phase 4C：

```text
roomId = call:{callSessionId}
```

房间是业务索引，不是独立 WebSocket 实例。广播必须通过 `roomId -> Set<connectionId>` 精准发送，禁止遍历所有连接再判断归属。

## 心跳与断线

Phase 3A 使用轻量心跳：

- 服务端每 25-30 秒发送 ping 或应用层 `ping`。
- 客户端 60-90 秒未收到服务端心跳则重连。
- 断线后客户端通过 REST 拉取历史补齐，不依赖 WS 重放。

## 多实例策略

Phase 3A 不实现 Redis Pub/Sub，多实例部署延后。

Scale 阶段扩展方式：

```text
apps/server #1  local sockets
apps/server #2  local sockets
apps/server #3  local sockets
        ↑
   Redis Pub/Sub
```

每个 server 实例只管理本机连接。跨实例广播通过 Redis channel（如 `room:{roomId}`）转发。Sticky session 可作为优化，但不是替代 Redis Pub/Sub 的核心机制。

## 多人通话边界

WebSocket 只承载实时消息与 WebRTC 信令，不承载音视频媒体流。多人通话 / 直播媒体必须交给 WebRTC P2P、SFU（如 LiveKit / mediasoup）或直播基础设施。`/ws/v1/signaling` 仅传递 offer/answer/ICE、加入、离开、挂断等信令事件。

## 原因

- 与 ADR 02 的 Bun + Hono 技术路线一致。
- 1:1 私聊 MVP 不需要 Socket.IO 或 Redis。
- 单实例 in-memory Hub 易于测试和理解，足以支撑学习项目和早期千级轻量连接。
- 房间抽象可平滑扩展到群聊与通话信令。

## 权衡

- 单实例重启会断开所有 WS 连接；客户端必须实现重连与 REST 补拉。
- 多实例之前，同一房间成员必须连接在同一实例才可内存广播；生产扩展需引入 Redis Pub/Sub。
- Bun 原生 WS 的运维经验需要在 Phase 3A 验收中记录。

## 后续

1. 扩写 [realtime-spec.md](../realtime-spec.md) 的连接、心跳、错误帧与事件 payload。
2. 实现 `realtime/chat-hub.ts` 与 WS auth。
3. Phase 3B 前评估 typing、session.revoked 与 Redis Pub/Sub 是否进入范围。

## 相关

- [ADR 02 — 后端运行时与框架](./02-backend-framework.md)
- [ADR 14 — 消息写入与投递](./14-message-delivery.md)
- [realtime-spec.md](../realtime-spec.md)
- [phase-3-plan.md](../archive/phase-3-plan.md)
