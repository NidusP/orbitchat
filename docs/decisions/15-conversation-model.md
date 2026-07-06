# ADR 15：1:1 会话与消息模型

- **状态**：Accepted
- **日期**：2026-07-03
- **阶段**：Phase 3A

## 背景

Phase 3A 要实现 1:1 私聊 MVP。未来 Phase 3B 会加入群聊，Phase 4B AI Agent 也会复用消息能力执行 `send_dm` Tool。数据模型需要既支持当前私聊，又避免为了群聊提前引入过多复杂度。

已有基础：

- 用户与 Session 表已完成。
- Phase 2 用户搜索、Profile、关注关系已完成，可作为发起聊天入口。
- WebSocket 房间模型由 ADR 13 定义。
- 消息写入与投递由 ADR 14 定义。

## 选项

### 1. 1:1 专用表 + 群聊另建表

例如 `direct_messages` 与 `group_messages` 分开。

- 优点：每种场景字段简单。
- 缺点：后续 API、分页、WS payload、搜索历史会重复；AI `send_dm` 与群消息扩展需要两套逻辑。

### 2. 统一 conversations / members / messages

1:1 与群聊都通过会话、成员、消息表达；Phase 3A 只允许 `direct` 类型。

- 优点：消息 API 与 WS payload 统一；后续群聊可增量扩展；符合常见聊天模型。
- 缺点：1:1 需要额外约束“两成员唯一”；群聊字段需要后续迁移补充。

### 3. messages 多态外键

`messages` 同时有 `conversation_id`、`group_id` 或 `target_type/target_id`。

- 优点：看起来灵活。
- 缺点：约束复杂；查询和索引容易变差；Phase 3A 不需要。

## 决策

选择 **统一 conversations / conversation_members / messages**，Phase 3A 只实现 1:1 私聊。

Phase 3A 表：

```text
conversations
conversation_members
messages
```

Phase 3B 再扩展：

```text
chat_groups
chat_group_members
```

或评审是否把群聊也映射到 `conversations.type = 'group'`。3A 不提前实现群表。

## Phase 3A 数据模型

### conversations

会话元信息。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| type | ENUM | Phase 3A 固定 `direct` |
| last_message_at | TIMESTAMPTZ | 可空；会话排序 |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### conversation_members

会话成员与读状态。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| conversation_id | UUID FK → conversations | |
| user_id | UUID FK → users | |
| last_read_at | TIMESTAMPTZ | 可空；简化已读 |
| joined_at | TIMESTAMPTZ | |
| left_at | TIMESTAMPTZ | 可空；3A 默认不用 |

约束与索引：

- `UNIQUE (conversation_id, user_id)`
- INDEX `(user_id, conversation_id)`

### messages

消息事实表。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| conversation_id | UUID FK → conversations | |
| sender_id | UUID FK → users | |
| content | TEXT NOT NULL | Phase 3A 纯文字；最长 2000 字符 |
| created_at | TIMESTAMPTZ | |
| edited_at | TIMESTAMPTZ | 可空；3A 不实现编辑 |
| deleted_at | TIMESTAMPTZ | 可空；3A 不实现删除 |

约束与索引：

- INDEX `(conversation_id, created_at DESC, id DESC)` — 历史分页。
- INDEX `(sender_id, created_at DESC)` — 用户消息排查 / 后续审计。

## 1:1 唯一性

Phase 3A 需要保证两个用户之间只有一个 direct conversation。

推荐实现方式：

- 在应用层计算 `directKey = sort(userA, userB).join(':')`。
- `conversations` 增加 `direct_key VARCHAR UNIQUE`，仅 `type = direct` 使用。
- 创建会话时用事务或 `ON CONFLICT` 获取既有会话。

字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| direct_key | VARCHAR UNIQUE | `minUserId:maxUserId`；仅 direct 会话 |

Phase 3B 若群聊使用同一 `conversations` 表，则 `direct_key` 对群聊为空。

## 权限规则

Phase 3A：

- 任意两个 active 用户可以创建 1:1 会话。
- 不要求互相关注。
- 发消息、拉历史、标记已读必须是 conversation member。
- 自己不能和自己创建 direct conversation。
- `blocks` 尚未实现；后续接入后创建和发消息时过滤黑名单。

## 删除、编辑与撤回

Phase 3A 不实现消息编辑、删除、撤回；预留字段但 API 不暴露。

原因：

- 聊天 MVP 的核心是实时送达与历史一致。
- 编辑/撤回会引入额外 WS 事件：`message.updated`、`message.deleted`。
- 后续可在 Phase 3.1 增加。

## 未读与已读

Phase 3A 使用 `conversation_members.last_read_at`：

- 进入会话或显式标记已读时更新。
- 会话列表未读数可通过 `messages.created_at > last_read_at` 查询，必要时后续冗余计数。
- 不做逐条 read receipt。

## 与 AI Agent 的关系

Phase 4B 的 `send_dm` Tool 必须通过 Phase 3A `message-service` 发送消息，不直接写 `messages` 表。这样 AI 代发消息复用同一权限、投递、审计与 WS 广播路径。

## 原因

- 统一消息模型降低 REST、WS、Web UI 与 AI Tool 的重复实现。
- `direct_key` 让 1:1 唯一性简单可测。
- 群聊延后，避免 3A migration 和服务层过大。
- `last_read_at` 足以支撑 MVP 未读体验。

## 权衡

- `direct_key` 是应用层生成字段，需保证排序规则稳定。
- 预留编辑/删除字段但不开放 API，会有少量未使用字段。
- 群聊是否复用 `conversations` 表仍需 Phase 3B 前评审。

## 后续

1. 在 `db-schema.md` 展开 Phase 3A 详表。
2. 在 `api-spec.md` 定义 conversations / messages 契约。
3. 实现 `conversation-service` 和 `message-service`。
4. Phase 3B 前补 ADR 16：群聊模型与权限。

## 相关

- [ADR 13 — WebSocket 栈与连接管理](./13-websocket-stack.md)
- [ADR 14 — 消息写入与投递模型](./14-message-delivery.md)
- [db-schema.md](../db-schema.md)
- [api-spec.md](../api-spec.md)
