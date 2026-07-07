# ADR 16：群聊模型（Phase 3B）

- **状态**：Accepted
- **日期**：2026-07-06
- **阶段**：Phase 3B

## 背景

Phase 3A 已用统一 `conversations` / `conversation_members` / `messages` 实现 1:1 私聊（ADR 15）。Phase 3B 需要群聊，且 REST、WebSocket、`message.new` 广播应与私聊共用同一套消息管道。

ADR 15 预留了两条路径：独立 `chat_groups` 表，或 `conversations.type = 'group'` 扩展。

## 选项

### 1. 独立 chat_groups / chat_group_members

- 优点：群元信息与 1:1 完全隔离。
- 缺点：消息 API、WS 房间、分页、AI `send_dm` 与群消息需双轨；与 ADR 15「统一会话」方向冲突。

### 2. conversations.type = 'group' + 扩展字段

在现有 `conversations` 上增加 `title`、`created_by_user_id`；成员仍用 `conversation_members`。

- 优点：消息 REST/WS 零分叉；列表排序、已读、cursor 分页复用；与 ADR 15 一致。
- 缺点：群与 1:1 混在同表，需用 `type` 区分约束（如 `direct_key` 仅 direct 使用）。

### 3. 群消息独立 messages 表

- 优点：字段可定制。
- 缺点：重复实现；否决。

## 决策

选择 **选项 2**：`conversations.type = 'group'`，不新建 `chat_groups` 表。

## Phase 3B 数据模型

### conversations（扩展）

| 字段 | 类型 | 说明 |
|------|------|------|
| type | ENUM | `direct` \| `group` |
| title | VARCHAR(120) | 群名称；`direct` 为 NULL |
| created_by_user_id | UUID FK → users | 群主；`direct` 为 NULL |
| direct_key | VARCHAR | 仅 `direct` 使用，保持 UNIQUE |

### conversation_members

Phase 3B 不新增 `role` 字段；群主通过 `created_by_user_id` 标识。后续如需踢人、转让群主再加 `role` 或独立审计表。

### messages

无变更；群消息与私聊共用。

## API

- `POST /api/v1/conversations` 支持 discriminated body：
  - `{ participantUserId }` — 1:1（兼容 3A，可省略 `type`）
  - `{ type: 'group', title, memberUserIds }` — 创建群；创建者自动入群
- 其余 `GET/POST messages`、WS `message.new` / `message.read` 不变。

## WebSocket

群会话房间仍为 `conversation:{id}`（ADR 13）；成员加入会话时 `join` 同一房间名。

## 范围外（本阶段）

- 群管理员角色、踢人、邀请链接
- `typing`、`presence`
- Redis 多实例 Pub/Sub
- 群头像、群公告

## 后续

1. 更新 `docs/db-schema.md`、`docs/api-spec.md`、`shared-types`
2. Drizzle 迁移：enum 增加 `group`，表增加 `title`、`created_by_user_id`
3. `conversation-service.createGroupConversation`
4. Web `/messages` 列表展示群标题；新建群 UI

## 相关

- [ADR 15：1:1 会话与消息模型](./15-conversation-model.md)
- [ADR 13：WebSocket 栈](./13-websocket-stack.md)
- [ADR 14：消息投递](./14-message-delivery.md)
