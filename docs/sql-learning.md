# SQL 学习与 Orbitchat 实战

> 本文档整理 Orbitchat 开发过程中遇到的 **SQL / 索引 / 查询模式** 要点，并与项目真实 schema、服务代码对照。  
> 适合边做 Phase 2+ 边回顾；概念懂了之后，用 `EXPLAIN ANALYZE` 验证。

**相关文档**：[db-schema.md](./db-schema.md)（表结构）、[ADR 10–11](./decisions/10-social-content-storage.md)（存储与 Feed 决策）、[Use The Index, Luke](https://use-the-index-luke.com/)（索引专题外部参考）

---

## 怎么用

| 场景 | 建议 |
|------|------|
| 第一次理解索引 | 读 §1 → §2 → 在本地跑 §6 练习 1 |
| 写 Feed / 关注查询 | 读 §4.1、§4.2 |
| 写列表接口怕慢 | 读 §3（N+1、IN、cursor） |
| Phase 4 加媒体 | 读 §5 |
| 每完成一个 Phase | 回来补 §7「阶段索引」勾选 |

---

## 1. 核心直觉

### 1.1 索引 ≈ `Map.get(key)`，全表扫描 ≈ `数组.find()`

| | 有索引且查询命中索引 | 无索引 / 未命中 |
|--|----------------------|-----------------|
| 行为 | 按 key 定位，再读少量行 | 逐行扫描整张表 |
| 表变大 | 成本缓慢上升（B-tree 更深） | 成本线性变差 |
| 口诀 | **表大 ≠ 一定慢；没索引才容易慢** |

PostgreSQL 默认最常用 **B-tree 索引**（Drizzle `index()` 生成的即是）。

### 1.2 主键 / UNIQUE 自带索引

- `PRIMARY KEY`、`UNIQUE` 约束会自动建索引
- **外键列不会自动建索引** — 若经常 `WHERE post_id = ?`，需自己加（见 `likes.post_id`）

### 1.3 复合索引与最左前缀

索引 `(author_id, created_at)` 能很好服务：

```sql
WHERE author_id = $1 ORDER BY created_at DESC
```

单独 `WHERE created_at > ...`（没有 `author_id`）通常**用不上**这个复合索引的前缀规则 — 设计索引时要对着真实 `WHERE` / `ORDER BY` 写。

### 1.4 部分索引（Partial Index）

只索引满足条件的行，更小、更快：

```sql
-- 等价于 user_sessions 的 Drizzle 定义
CREATE INDEX user_sessions_user_id_active_idx
  ON user_sessions (user_id)
  WHERE revoked_at IS NULL;
```

Phase 2 `posts`、`comments` 对 `deleted_at IS NULL` 做了同样思路 — 软删除列表不扫已删行。

---

## 2. Orbitchat 索引地图（Phase 1–2）

| 表 | 索引 | 服务的典型查询 |
|----|------|----------------|
| `users` | PK、`username`/`email` UNIQUE | 登录、按 id 查 |
| `user_sessions` | `(user_id) WHERE revoked_at IS NULL` | 同端 SSO、Session 校验 |
| `posts` | `(author_id, created_at) WHERE deleted_at IS NULL` | 用户主页时间线 |
| `comments` | `(post_id, created_at) WHERE deleted_at IS NULL` | 帖下评论列表 |
| `likes` | `UNIQUE(user_id, post_id)`、`(post_id)` | 防重复赞、按帖查赞 |
| `follows` | `UNIQUE(follower, followee)`、`(follower_id)`、`(followee_id)` | Feed 扇出、粉丝/关注列表 |

**代码 SSOT**：`apps/server/src/db/schema/*.ts`  
**迁移 SQL**：`apps/server/drizzle/0001_*.sql`

---

## 3. 查询模式：好 vs 坏

### 3.1 N+1（坏）

```text
1. SELECT * FROM posts ... LIMIT 20     -- 20 条
2. 对每条 post 再查 author / likes    -- 又 20+ 次
→ 21+ 次往返
```

子表、`JOIN`、`IN` 本身不导致 N+1；**在循环里逐条查**才会。

### 3.2 批量 `IN`（好）

Feed 返回 20 帖后，一次拉齐点赞态：

```33:41:apps/server/src/lib/social-loaders.ts
export async function loadLikedPostIds(viewerId: string, postIds: string[]): Promise<Set<string>> {
  // ...
  const rows = await db
    .select({ postId: likes.postId })
    .from(likes)
    .where(and(eq(likes.userId, viewerId), inArray(likes.postId, postIds)));
```

SQL 概念：

```sql
SELECT post_id FROM likes
WHERE user_id = $viewer AND post_id = ANY($ids::uuid[]);
```

- 有 `likes(post_id)` 或 `UNIQUE(user_id, post_id)` 时，按 id 查找快
- **表总行数很大也没关系** — 关键是索引 + 一次 IN 的 id 个数（Feed 一页 ~20）

### 3.3 一条 SQL + JOIN / EXISTS（好）

首页 Feed **读扇出**（ADR 11）：发帖时不写收件箱，查询时找「我关注的人 + 自己」的帖。

`follows_follower_id_idx` 让 `WHERE follower_id = 当前用户` 像 Map 查找：

```17:24:apps/server/src/db/schema/follows.ts
  (table) => [
    unique('follows_follower_followee_unique').on(table.followerId, table.followeeId),
    // Home feed fan-out: JOIN follows ON followee_id = posts.author_id WHERE follower_id = ?
    index('follows_follower_id_idx').on(table.followerId),
    index('follows_followee_id_idx').on(table.followeeId),
  ]
```

实现见 `apps/server/src/services/feed-service.ts`（`exists` 子查询 + `posts` 过滤）。

### 3.4 Cursor 分页 vs OFFSET（Feed 用 cursor）

| | Cursor `(created_at, id)` | `OFFSET 10000` |
|--|---------------------------|----------------|
| 稳定性 | 新帖不影响已翻页游标 | 深页越来越慢 |
| Orbitchat | ADR 11，`lib/cursor.ts` | **不用** |

条件概念：

```sql
AND (created_at, id) < ($cursorTime, $cursorId)
ORDER BY created_at DESC, id DESC
LIMIT 21
```

多取 1 条判断是否有 `nextCursor`（`limit + 1` 模式）。

---

## 4. Phase 2 端到端：API 动作 → SQL

### 4.1 打开首页 Feed — `GET /feed/home`

```text
请求 1（posts）
  WHERE deleted_at IS NULL
    AND (author_id = 我 OR EXISTS (
          SELECT 1 FROM follows
          WHERE follower_id = 我 AND followee_id = posts.author_id))
  ORDER BY created_at DESC, id DESC
  LIMIT 21

请求 2（批量作者）— inArray(user_id, [...])
请求 3（批量点赞）— loadLikedPostIds，见 §3.2
```

**学习点**：3 次查询，不是 20+ 次；瓶颈通常在 Feed 主查询，不在点赞 `IN`。

### 4.2 用户主页 — `GET /users/:id/posts`

```text
WHERE author_id = $id AND deleted_at IS NULL
ORDER BY created_at DESC, id DESC
→ posts_author_timeline_idx
```

### 4.3 点赞 — `POST /posts/:id/like`

```text
INSERT INTO likes (user_id, post_id) ...
UPDATE posts SET like_count = like_count + 1 ...
```

`UNIQUE(user_id, post_id)` 保证幂等；应用层可先查再插，或依赖唯一约束捕获冲突。

### 4.4 评论列表 — `GET /posts/:id/comments`

```text
WHERE post_id = $id AND deleted_at IS NULL
ORDER BY created_at DESC
→ comments_post_timeline_idx
```

Web 展开评论面板时才请求（懒加载），列表页不会白打这条 SQL。

### 4.5 用户搜索 — `GET /users/search?q=`

Phase 2 使用 `ILIKE '%q%'`（`follow-service.ts`）。数据量大后可启用 `pg_trgm` + GIN（ADR 10 规划）。

---

## 5. 表设计取舍（与 SQL 的关系）

| 方案 | 何时够用 | SQL 影响 |
|------|----------|----------|
| `posts.content` 纯 `TEXT` | Phase 2 仅文字 | 简单，Feed 行窄 |
| `image_urls TEXT[]` | 每帖 0–4 个 URL、无元数据 | 无 JOIN，行变宽 |
| `post_media` 子表（Phase 4 规划） | 多图/视频 + 元数据 | 列表 `JOIN` 或二次 `IN` 批量拉取 |
| `content JSONB` blocks | 文中穿插媒体（公众号式） | 查询/校验复杂，**推文式不必** |

**结论**：加媒体时，`post_media` + 批量 `IN` 通常优于 `TEXT[]`；与 JSONB 无关。详见 [ADR 10](./decisions/10-social-content-storage.md)。

**Feed 加载 media 约定**（Phase 4 起）：

- 禁止 per-post 循环查 media（N+1）
- 用 `WHERE post_id = ANY($ids)` 或 `JOIN` + `json_agg` 一次带走

---

## 6. 动手练习（本地 Postgres）

前置：`pnpm dev` 或 Docker Postgres + `pnpm --dir apps/server db:migrate`，库名 `orbitchat`。

### 练习 1：看索引是否命中

```sql
EXPLAIN ANALYZE
SELECT * FROM posts
WHERE author_id = '...'::uuid
  AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 20;
```

关注输出：

| 字样 | 含义 |
|------|------|
| `Seq Scan on posts` | 全表扫 — 检查是否缺索引或统计信息过旧 |
| `Index Scan` / `Bitmap Index Scan` | 在用索引 — 一般 OK |
| `rows=` / `actual time=` | 实际读行数与耗时 |

### 练习 2：对比有无索引的 `post_id` 查询

```sql
-- 有 comments_post_timeline_idx 时应走索引
EXPLAIN ANALYZE
SELECT * FROM comments
WHERE post_id = '...'::uuid AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 20;
```

### 练习 3：模拟 Feed 扇出

用 `psql` 把 `feed-service.ts` 的 `exists` 逻辑写成原生 SQL，对 `follows`、`posts` 各跑 `EXPLAIN ANALYZE`，观察是否用到 `follows_follower_id_idx`。

### 练习 4：批量 IN 规模

对 `likes` 表插入测试数据后：

```sql
EXPLAIN ANALYZE
SELECT post_id FROM likes
WHERE user_id = '...'::uuid
  AND post_id = ANY(ARRAY['...','...']::uuid[]);
```

体会：**id 数组长度 20 vs 表总行数百万** — 耗时差别主要来自索引，而非表总大小。

---

## 7. 阶段索引（随项目勾选）

| Phase | 已写入本文的章节 | 待补充 |
|-------|------------------|--------|
| Phase 1 | `user_sessions` 部分索引 | — |
| Phase 2 | §2、§4 全节 | — |
| Phase 3 | — | 消息表高写入、会话未读计数 |
| Phase 4 | §5 `post_media` | 对象存储与 DB 一致性 |
| Phase 5+ | — | 读写分离、缓存、写扇出 |

---

## 8. 实现检查清单（Code Review）

写新列表/Feed 接口时自问：

- [ ] `WHERE` 列是否有索引（或复合索引覆盖 `ORDER BY`）？
- [ ] 是否避免 N+1（批量 `inArray` / `JOIN` / `json_agg`）？
- [ ] 分页是否用 cursor，而非深 `OFFSET`？
- [ ] 软删除是否用 `deleted_at IS NULL` + 部分索引？
- [ ] 唯一业务规则是否用 `UNIQUE`（如点赞）？
- [ ] 能否用 `EXPLAIN ANALYZE` 说明为何够快？

---

## 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| 0.1.0 | 2026-06-30 | 初版：索引直觉、Phase 1–2 索引地图、N+1/IN/Feed/评论、练习与检查清单 |
