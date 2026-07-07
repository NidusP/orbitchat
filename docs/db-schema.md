# 数据库设计 - Orbitchat

## 概览

本文档描述 Orbitchat 的数据模型，供 Phase 1+ 实现与 review 使用。

**技术栈**（已定，见 ADR）：
- 数据库：**PostgreSQL 16+**（[ADR 06](./decisions/06-database-choice.md)）
- ORM：**Drizzle**（[ADR 07](./decisions/07-orm-selection.md)）

查询与索引学习见 [sql-learning.md](./sql-learning.md)（与 Phase 2+ 实现对照）。

---

## 文档维护策略

> 回答「是否随功能进度迭代？」— **是，分阶段迭代，不要一次写死。**

| 文档区块 | 何时更新 | 权威来源 |
|----------|----------|----------|
| **Phase 1 表** | Phase 1 开发前定稿；迁移变更时同步 | `apps/server/src/db/schema/` |
| **Phase 2+ 表** | 进入对应 Phase 前展开字段；之前保持概要 | 同上 |
| **关系图** | 每 Phase 结束更新 | 本文档 |
| **索引 / 查询** | 功能实现 + 性能测试后补充 | 本文档 + 代码注释 |

**规则**：
1. Drizzle schema 是 DB 结构的 **实现 SSOT**
2. 本文档是 **人类可读概览**；有冲突以 schema + migration 为准
3. 新表：先在本文件写概要 → 写 ADR（若涉及新选型）→ 写 Drizzle schema → migrate

**当前状态**：Phase 1–2 表已详细定义；Phase 3A 表为编码前草案。

---

## Phase 1：用户与认证（当前详细）

### users

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| username | VARCHAR UNIQUE | |
| email | VARCHAR UNIQUE | |
| password_hash | VARCHAR | bcrypt / argon2id |
| is_active | BOOLEAN | 默认 true |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### profiles

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| user_id | UUID FK → users UNIQUE | 1:1 |
| display_name | VARCHAR | |
| bio | TEXT | 可空 |
| avatar_url | VARCHAR | 可空 |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### user_sessions

认证与多端 Session（[ADR 08](./decisions/08-auth-strategy.md) — 行为与 Token 策略；**本表为结构 SSOT**）。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | JWT `sid` |
| user_id | UUID FK → users | |
| device_id | VARCHAR | 客户端 X-Device-Id |
| platform | ENUM | web / ios / android / desktop |
| device_name | VARCHAR | 可空 |
| is_trusted | BOOLEAN | 默认 false |
| refresh_token_hash | VARCHAR | SHA-256 |
| last_active_at | TIMESTAMPTZ | |
| expires_at | TIMESTAMPTZ | |
| revoked_at | TIMESTAMPTZ | 可空 |
| created_at | TIMESTAMPTZ | |

**约束与索引**：
- 同端 SSO：应用层保证每 `(user_id, platform)` 仅一条 `revoked_at IS NULL`（登录时 revoke 旧记录）
- INDEX `(user_id)` WHERE revoked_at IS NULL

---

## Phase 2：社交与动态（已定稿，见 ADR 10–12）

**决策**：[ADR 10](./decisions/10-social-content-storage.md)、[ADR 11](./decisions/11-feed-timeline-strategy.md)、[ADR 12](./decisions/12-phase2-client-sync.md)

### posts

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| author_id | UUID FK → users | 发帖人 |
| content | TEXT NOT NULL | 纯文字；API 最长 2000 字符 |
| like_count | INTEGER | 默认 0；冗余计数 |
| comment_count | INTEGER | 默认 0；冗余计数 |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |
| deleted_at | TIMESTAMPTZ | 可空；软删除 |

**索引**：
- `(author_id, created_at DESC)` WHERE `deleted_at IS NULL` — 个人主页时间线
- `(created_at DESC, id DESC)` WHERE `deleted_at IS NULL` — 辅助全局查询（可选）

### comments

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| post_id | UUID FK → posts | |
| author_id | UUID FK → users | |
| content | TEXT NOT NULL | API 最长 1000 字符 |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |
| deleted_at | TIMESTAMPTZ | 可空；软删除 |

**索引**：`(post_id, created_at DESC)` WHERE `deleted_at IS NULL`

Phase 2 **无** `parent_id`（扁平评论）；楼中楼留后续迁移。

### likes

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| user_id | UUID FK → users | |
| post_id | UUID FK → posts | |
| created_at | TIMESTAMPTZ | |

**约束**：`UNIQUE (user_id, post_id)`

**索引**：`(post_id)` — 查某帖点赞用户（管理端/未来功能）

### follows

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| follower_id | UUID FK → users | 关注者 |
| followee_id | UUID FK → users | 被关注者 |
| created_at | TIMESTAMPTZ | |

**约束**：
- `UNIQUE (follower_id, followee_id)`
- `CHECK (follower_id <> followee_id)`

**索引**：
- `(follower_id)` — 首页 Feed 读扇出
- `(followee_id)` — 粉丝列表

### 用户搜索（无新表）

- 启用扩展 `pg_trgm`
- GIN 索引：`users.username`、`profiles.display_name`（实现时定具体表达式索引）

### Phase 2 延后

| 表 | 用途 |
|----|------|
| blocks | 黑名单 |
| notifications | 站内通知 |
| tags / post_tags | 话题标签 |

---

## Phase 3：聊天（3A 已定稿）

**决策**：[ADR 13](./decisions/13-websocket-stack.md)、[ADR 14](./decisions/14-message-delivery.md)、[ADR 15](./decisions/15-conversation-model.md)

Phase 3A 只实现 1:1 私聊。群聊、逐条已读、推送通知延后。

### conversations

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| type | ENUM | `direct` \| `group` |
| title | VARCHAR(120) | 群名称；`direct` 为 NULL |
| created_by_user_id | UUID FK → users | 群主；`direct` 为 NULL |
| direct_key | VARCHAR UNIQUE | `minUserId:maxUserId`；仅 direct 会话 |
| last_message_at | TIMESTAMPTZ | 可空；会话列表排序 |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**约束与索引**：
- `UNIQUE (direct_key)` — 保证两名用户只有一个 1:1 会话
- `(last_message_at DESC, updated_at DESC)` — 会话列表排序

### conversation_members

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| conversation_id | UUID FK → conversations | |
| user_id | UUID FK → users | |
| role | conversation_member_role | 可空；**仅 group** 使用：`owner` / `admin` / `member`；direct 为 NULL |
| last_read_at | TIMESTAMPTZ | 可空；简化已读 |
| joined_at | TIMESTAMPTZ | |
| left_at | TIMESTAMPTZ | 可空；退群 / 踢人时写入 |

**约束与索引**：
- `UNIQUE (conversation_id, user_id)`
- `(user_id, conversation_id)` — 查用户会话成员身份
- `(conversation_id)` — 广播 / 权限检查时查成员

**群角色（Phase 3B.1）**：
- 建群：创建者 `owner`，初始成员 `member`
- 每群有且仅有 1 个 `owner`；转让后原 owner 降为 `admin`
- **owner 不可直接退群**（须先 `POST /transfer-owner`）；`member` / `admin` 可 `POST /leave`
- 权限以 `role` 为准；`conversations.created_by_user_id` 保留审计，转让后不强制同步

枚举 `conversation_member_role`：`owner` | `admin` | `member`

### messages

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| conversation_id | UUID FK → conversations | |
| sender_id | UUID FK → users | |
| content | TEXT NOT NULL | Phase 3A 纯文字；API 最长 2000 字符 |
| created_at | TIMESTAMPTZ | |
| edited_at | TIMESTAMPTZ | 可空；3A 不开放编辑 |
| deleted_at | TIMESTAMPTZ | 可空；3A 不开放删除 |

**约束与索引**：
- `(conversation_id, created_at DESC, id DESC)` — 历史消息 cursor 分页
- `(sender_id, created_at DESC)` — 用户消息排查 / 未来审计

### Phase 3B / 3B.1（群聊与群管理）

群聊复用 `conversations.type = 'group'`，不新建 `chat_groups` 表。见 [ADR 16](./decisions/16-group-chat-model.md)、[phase-3b1-group-plan.md](./phase-3b1-group-plan.md)。

| 能力 | 状态 |
|------|------|
| 建群 + 群消息 | Phase 3B ✅ |
| `conversation_members.role`、拉人/踢人/退群/改名/转让 | Phase 3B.1 ✅ |
| 1:1 typing（群聊不做） | Phase 3B.1 ✅ |
| 邀请链接 / 解散群 | P1 延后 |
| message_reads 逐条已读 | 延后 |
| presence | 延后 |

*WS 协议见 [realtime-spec.md](./realtime-spec.md)。*

---

## Phase 4A：AI Chat

### agents

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| slug | VARCHAR(64) UNIQUE | 内置 Agent 稳定标识 |
| name | VARCHAR(120) | 展示名 |
| description | TEXT | 简介 |
| system_prompt | TEXT | Agent 系统提示词 |
| is_builtin | BOOLEAN | 4A 默认 true |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**索引**：
- `(is_builtin)` — 列出内置 Agent

### ai_conversations

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| user_id | UUID FK → users | 会话拥有者 |
| agent_id | UUID FK → agents | 选用 Agent |
| title | VARCHAR(200) | 可空；默认可由首条消息生成 |
| tictactoe_data | JSONB | 可空；井字棋当前盘与历史对局（`active` + `history[]`） |
| last_message_at | TIMESTAMPTZ | 可空；列表排序 |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**索引**：
- `(user_id, last_message_at)` — 当前用户 AI 会话列表
- `(agent_id)` — Agent 使用情况排查

### ai_messages

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| conversation_id | UUID FK → ai_conversations | |
| role | ai_message_role | `user` / `assistant` / `system` / `tool` |
| content | TEXT | 消息正文或 tool 输出摘要 |
| tool_name | VARCHAR(64) | tool 消息时记录工具名 |
| created_at | TIMESTAMPTZ | |

**索引**：
- `(conversation_id, created_at)` — AI 历史消息分页

### ai_tool_calls

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| conversation_id | UUID FK → ai_conversations | |
| requested_by_user_id | UUID FK → users | 发起确认的用户 |
| tool_name | VARCHAR(64) | 如 `send_dm` |
| status | ai_tool_call_status | `pending` / `approved` / `rejected` / `executed` / `failed` |
| input | JSONB | Tool 输入草稿 |
| output | JSONB | 执行结果 |
| error | TEXT | 失败原因 |
| created_at / updated_at | TIMESTAMPTZ | |
| confirmed_at | TIMESTAMPTZ | 用户确认或拒绝时间 |
| executed_at | TIMESTAMPTZ | 执行完成时间 |

**索引**：
- `(conversation_id, created_at)` — 会话内审计列表
- `(requested_by_user_id, status)` — 用户待确认操作

## Phase 4B+：橱窗 / 音视频（概要）

| 表 / 服务 | 用途 | 状态 |
|-----------|------|------|
| ai_tool_calls | Agent 写操作审计 | 📋 Phase 4B |
| call_sessions | 通话记录 | 📋 Phase 4 |
| storefront.* | 商品、订单 | 📋 可能独立 DB（Go 服务） |

---

## 关系图（当前）

```
User (1) ──┬── (1) Profile
           └── (M) UserSession

           ├── (M) Post ──┬── (M) Comment
           │              └── (M) Like
           ├── (M) Follow (follower) ──► User (followee)
           └── (M) Follow (followee) ◄── User (follower)

Phase 3+ : User ── Message, ChatGroup, ...
```

---

## 迁移策略

| 阶段 | 迁移内容 |
|------|----------|
| Phase 1 | users, profiles, user_sessions |
| Phase 2 | posts, comments, likes, follows |
| Phase 3 | conversations, conversation_members, messages；groups 延后至 3B |
| Phase 4+ | ai_*, call_*, 或橱窗独立库 |

使用 `drizzle-kit generate` + `migrate`；每次 merge 前 migration 文件入库。

---

## 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| 0.0.1 | 2024-06-09 | 初始规划 |
| 0.1.0 | 2026-06-14 | 锁定 Postgres + Drizzle；Phase 1 详表；分阶段维护策略 |
| 0.2.0 | 2026-06-23 | Phase 2 详表（posts/comments/likes/follows）；ADR 10–12 |
| 0.2.1 | 2026-06-30 | 链至 [sql-learning.md](./sql-learning.md) |
| 0.3.0 | 2026-07-03 | Phase 3A 详表（conversations/conversation_members/messages）；ADR 13–15 |
