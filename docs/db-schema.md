# 数据库设计 - Orbitchat

## 概览

本文档描述 Orbitchat 的数据模型，供 Phase 1+ 实现与 review 使用。

**技术栈**（已定，见 ADR）：
- 数据库：**PostgreSQL 16+**（[ADR 06](./decisions/06-database-choice.md)）
- ORM：**Drizzle**（[ADR 07](./decisions/07-orm-selection.md)）

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

**当前状态**：Phase 1 表已详细定义；Phase 2+ 为规划概要。

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

## Phase 2：社交与动态（概要，待展开）

| 表 | 用途 | 状态 |
|----|------|------|
| posts | 用户动态 | 📋 Phase 2 前定稿 |
| comments | 评论 | 📋 |
| likes | 点赞 | 📋 |
| follows | 关注关系 | 📋 |

*进入 Phase 2 时在本节补充完整字段与索引。*

---

## Phase 3：聊天（概要，待展开）

| 表 | 用途 | 状态 |
|----|------|------|
| conversations | 1:1 对话 | 📋 Phase 3 前定稿 |
| chat_groups | 群聊 | 📋 |
| chat_group_members | 群成员 | 📋 |
| messages | 消息（私聊/群聊多态或分表，实现时定） | 📋 |

*WS 协议见 [realtime-spec.md](./realtime-spec.md)。*

---

## Phase 4+：AI / 橱窗 / 音视频（概要）

| 表 / 服务 | 用途 | 状态 |
|-----------|------|------|
| ai_conversations, ai_messages | AI Chat | 📋 Phase 4 |
| call_sessions | 通话记录 | 📋 Phase 4 |
| storefront.* | 商品、订单 | 📋 可能独立 DB（Go 服务） |

---

## 关系图（当前）

```
User (1) ──┬── (1) Profile
           └── (M) UserSession

Phase 2+ : User ── Post, Follow, ...
Phase 3+ : User ── Message, ChatGroup, ...
```

---

## 迁移策略

| 阶段 | 迁移内容 |
|------|----------|
| Phase 1 | users, profiles, user_sessions |
| Phase 2 | posts, comments, likes, follows |
| Phase 3 | conversations, groups, messages |
| Phase 4+ | ai_*, call_*, 或橱窗独立库 |

使用 `drizzle-kit generate` + `migrate`；每次 merge 前 migration 文件入库。

---

## 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| 0.0.1 | 2024-06-09 | 初始规划 |
| 0.1.0 | 2026-06-14 | 锁定 Postgres + Drizzle；Phase 1 详表；分阶段维护策略 |
