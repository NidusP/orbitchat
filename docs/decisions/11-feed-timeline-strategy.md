# ADR 11：Feed 时间线策略（Phase 2）

- **状态**：Accepted
- **日期**：2026-06-23
- **阶段**：Phase 2 启动前

## 背景

Phase 2 需展示两类时间线：

1. **首页 Feed**：当前用户所**关注**的人发布的动态
2. **个人主页**：某用户发布的全部（未删除）动态

另需决定：排序算法、分页方式、读路径扇出模型，以及是否做推荐流。

## 选项

### 扇出模型

| 选项 | 描述 | 优点 | 缺点 |
|------|------|------|------|
| **A. 读时扇出（fan-out on read）** | 请求时 JOIN `follows` + `posts` | 实现简单；写路径快；关注/发帖即时一致 | 大 V 粉丝多时读慢（学习项目可接受） |
| **B. 写时扇出（fan-out on write）** | 发帖时写入 `feed_items` 收件箱表 | 读 Feed 极快 | 写放大；删帖/删关注要清理收件箱 |
| **C. 混合** | 普通用户写扇出，大 V 读扇出 | 工业级 Twitter 方案 | 复杂度高 — **Phase 2 不做** |

### 排序与推荐

| 选项 | 描述 |
|------|------|
| **时间倒序** | `created_at DESC, id DESC` |
| **算法推荐** | 互动分、兴趣模型、探索流 |
| **全局热门** | 全站 trending |

### 分页

| 选项 | 描述 |
|------|------|
| **Offset** | `LIMIT/OFFSET` |
| **Cursor** | 基于 `(created_at, id)` 稳定游标 |

## 决策

### 扇出：读时扇出（fan-out on read）

首页 Feed 查询逻辑（概念）：

```sql
SELECT p.*
FROM posts p
INNER JOIN follows f ON f.followee_id = p.author_id
WHERE f.follower_id = :currentUserId
  AND p.deleted_at IS NULL
ORDER BY p.created_at DESC, p.id DESC
LIMIT :limit;
```

- **包含自己的帖**：首页 Feed **默认包含** `author_id = currentUserId` 的帖子（即使用户未 follow 自己）；实现可用 `UNION` 或 `OR` 条件，API 层保证不重复
- **不建** `feed_items` / `timeline` 冗余表
- 粉丝量 > 10k 时的性能优化留 Phase 5+（缓存、写扇出、Redis）

### 排序：纯时间倒序

- **无推荐算法**、无全站热门流、无「你可能认识」混排
- 个人主页与首页 Feed 使用相同排序键

### 分页：Cursor（禁止 offset 深翻）

请求 / 响应约定：

| 参数 | 说明 |
|------|------|
| `cursor` | 可选；opaque 或 `base64(createdAt\|id)`，指向上一页最后一条 |
| `limit` | 默认 `20`，最大 `50` |

响应 `data` 内携带 `items: Post[]` 与 `nextCursor: string | null`。

**稳定性**：排序键 `(created_at, id)` 组合唯一；新帖插入不影响已翻页游标。

### API 端点划分

避免模糊的 `GET /posts`，拆为：

| 端点 | 用途 |
|------|------|
| `GET /api/v1/feed/home` | 当前用户首页时间线（需登录） |
| `GET /api/v1/users/:id/posts` | 用户主页动态（公开可读；删除帖 404） |

发帖 / 改帖 / 删帖仍用 `/api/v1/posts` 资源路径（见 [api-spec.md](../api-spec.md)）。

### 可见性（Phase 2）

- **全部公开**：任意登录用户可读他人未删动态与主页时间线
- **私密账号 / 仅粉丝可见**：Phase 2 **不做**；字段不预留 `visibility` enum，避免半成品

## 原因

- 读扇出与现有 schema 最契合，SQL 可解释，适合学习项目演示
- 时间倒序是 MVP 社交产品默认体验，避免推荐系统分散 Phase 2 精力
- Cursor 分页防止深 offset 性能劣化，且与无限滚动 UI 天然匹配

## 权衡

- 关注人数极多时单条 SQL 变慢 — Phase 2 通过索引 `(follows.follower_id)`、`(posts.author_id, created_at DESC)` 缓解
- 无推荐流意味着产品探索性弱 — 接受，符合 roadmap 分阶段
- 全公开简化权限 — Phase 3+ 可按需加 `visibility`

## 后续

1. `api-spec.md` 补充 `feed/home`、cursor 信封字段
2. `shared-types`：`FeedPage`、`PaginationCursor`
3. `post-service` / `feed-service`：封装查询与 cursor 编解码
4. Web：首页 Feed 无限滚动 + 个人主页 Tab

## 相关

- [ADR 10 — 内容存储](./10-social-content-storage.md)
- [ADR 12 — 客户端同步](./12-phase2-client-sync.md)
- [db-schema.md](../db-schema.md)
- [sql-learning.md](../sql-learning.md) — 索引与 Feed 查询实战
