# ADR 08：认证与会话策略（多端 + 同端 SSO + 信任设备）

- **状态**：Accepted
- **日期**：2026-06-14
- **阶段**：Phase 1

## 背景

Orbitchat 需支持 Web、iOS、Android 等多端同时在线，并满足：

1. **多端在线**：用户可在 Web + 手机等不同平台同时保持登录
2. **同端单点登录**：同一平台（如 `web`）仅一个活跃 Session；新登录踢掉旧 Session
3. **信任设备管理**：用户可将常用设备标记为「信任」
4. **信任设备可下线其他终端**：信任设备可查看并 revoke 其他 Session

需选择可审计、可撤销、适合 TS 全栈实现的方案。

## 选项

1. **纯 JWT 无状态（仅 access + refresh，无 Session 表）**
   - 优点：实现简单
   - 缺点：难以踢下线、同端 SSO、设备列表 — **不满足需求**

2. **Session 表 + 双 Token**
   - Access JWT 短期 + Refresh opaque + DB Session 记录
   - 优点：可 revoke、可设备管理、同端 SSO 可查表实现
   - 缺点：refresh 需查库（Phase 1 可接受）

3. **OAuth2/OIDC 外包（Auth0 / Clerk / Keycloak）**
   - 优点：功能全、安全由厂商维护
   - 缺点：学习项目希望掌控核心；额外成本

4. **Session Cookie only（无 JWT）**
   - 优点：Web 简单
   - 缺点：RN 不友好 — **不适合多端**

## 决策

采用 **Session 表 + 双 Token**（Access JWT + Refresh Token rotation），自研于 Hono + Postgres + Drizzle。

**数据模型（字段 / 索引）**：见 [db-schema.md — user_sessions](../db-schema.md#user_sessions)，Drizzle schema 为实现 SSOT。  
**HTTP 端点列表**：见 [api-spec.md — Phase 1](../api-spec.md#phase-1--用户与认证)。  
**各端 Token 存储与刷新**：见 [multi-client.md](../multi-client.md)。

## 行为模型

### 同端单点登录（SSO per platform）

登录成功时：

```
1. 查找该 user_id + platform 下 revoked_at IS NULL 的 Session
2. 若存在 → revoke 旧 Session（可选 WS 推送 session.revoked）
3. 创建新 Session，签发 access + refresh
```

**跨平台互不影响**：`web` 与 `ios` 各保留一条活跃 Session。

### 多端在线

- 每个 `platform` 最多 **1** 个活跃 Session
- 理论最大并发 Session 数 = 平台种类数（通常 ≤ 4）

### Token 策略

| Token | 形式 | 默认有效期 | 客户端存储 |
|-------|------|------------|------------|
| Access | JWT（`sub`, `sid`, `platform`） | 15 分钟 | 内存 |
| Refresh | opaque 随机串 | 30 天（可配置「保持登录」） | 见 multi-client.md |

**Refresh Token Rotation**：每次 refresh 签发新 refresh，旧 hash 作废；检测到已使用的 refresh → revoke 该 Session（防重放）。

### 请求校验（Hono middleware）

```
1. 解析 Authorization Bearer JWT，验证签名与 exp
2. 查 user_sessions：sid 存在且 revoked_at IS NULL（Phase 1 推荐严格模式）
3. 注入 userId、sessionId 到 Context
```

## 信任设备

**信任设备**：`is_trusted = true` 的 Session，通常登录时勾选「信任此设备」或设置页手动开启。Phase 2+ 可加邮件/TOTP 二次确认。

| 操作 | 普通 Session | 信任设备 |
|------|-------------|----------|
| 使用 API | ✅ | ✅ |
| 查看全部 Session 列表 | ❌ | ✅ |
| 下线其他 Session | ❌ | ✅ |
| 下线当前 Session | ✅ | ✅ |
| logout-all（保留当前） | ❌ | ✅ |

## 密码

- 哈希：bcrypt（cost 10–12）或 argon2id（Phase 1 实现时二选一）
- API 与日志永不输出 `password_hash`

## 实时通知（Phase 3 可选）

Session 被 revoke 且设备 WS 在线时，推送 `session.revoked`，客户端立即清凭证。

## 权衡

- 严格校验 Session 增加 DB 读；Phase 3+ 可用 Redis 缓存 `sid → valid`
- **自研认证的安全责任**：
  - **安全审计**：上线前对照 OWASP、认证 checklist 自查设计/代码（Token 存储、CSRF、速率限制等）
  - **渗透测试（Penetration Test）**：生产面向公众前，由安全人员模拟攻击验证可利用性；学习项目 Phase 1 不做，但需知晓差距

## 后续（Phase 1 实现）

1. Drizzle schema：`users`、`profiles`、`user_sessions`（见 db-schema）
2. `shared-types`：`Session`、`LoginResponse` 等
3. Hono：`authMiddleware`、`routes/v1/auth.ts`、`sessionService`
4. Web：`lib/api` + httpOnly refresh Cookie（见 multi-client）

## 相关

- [multi-client.md](../multi-client.md)
- [db-schema.md](../db-schema.md)
- [api-spec.md](../api-spec.md)
- [06-database-choice.md](./06-database-choice.md)
- [07-orm-selection.md](./07-orm-selection.md)
