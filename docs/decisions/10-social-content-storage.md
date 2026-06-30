# ADR 10：社交内容存储模型（Phase 2）

- **状态**：Accepted
- **日期**：2026-06-23
- **阶段**：Phase 2 启动前

## 背景

Phase 2 需持久化动态（Post）、评论、点赞与关注关系。需在「存储介质、表结构、删除语义、媒体形态」上定稿，以便编写 Drizzle schema、`shared-types` 与 API。

约束：

- 主库已选 **PostgreSQL + Drizzle**（ADR 06、07）
- Phase 2 范围：纯文字动态；图片/视频属 Phase 4
- 学习项目优先：**可读 schema、易迁移、查询可解释**，不过早引入专用搜索引擎或文档库

## 选项

### 1. 关系型规范化（Postgres 多表）

`posts`、`comments`、`likes`、`follows` 分表，外键指向 `users`。

- 优点：与现有 Phase 1 模型一致；事务与约束清晰；Feed / 关注图查询成熟
- 缺点：高扇出时读路径需索引优化（见 ADR 11）

### 2. JSONB 文档型 Post（单表存 blocks）

`posts.content` 为 JSONB（段落、未来嵌入媒体块）。

- 优点：扩展富文本灵活
- 缺点：Phase 2 仅文字，过早复杂；校验与迁移成本高

### 3. 混合：Postgres 元数据 + 对象存储正文

正文或媒体放 S3，DB 只存指针。

- 优点：适合大媒体
- 缺点：Phase 2 无媒体；多一跳依赖 — **过度设计**

### 4. 独立搜索引擎 / 图数据库（Elasticsearch、Neo4j）

- 优点：搜索 / 关系图极强
- 缺点：运维与学习成本高；当前规模不需要

## 决策

采用 **PostgreSQL 规范化多表**，Phase 2 实现四张核心表：

| 表 | 用途 |
|----|------|
| `posts` | 用户动态（纯文字） |
| `comments` | 对动态的评论 |
| `likes` | 用户对动态的点赞（每用户每帖至多一次） |
| `follows` | 有向关注边 `follower → followee` |

**延后至 Phase 2 后期或 Phase 2.1**（不阻塞 MVP）：`blocks`（黑名单）、评论点赞、话题标签 `tags` / `post_tags`。

### 字段与语义（概要）

完整字段见 [db-schema.md — Phase 2](../db-schema.md#phase-2社交与动态)。

| 实体 | 关键规则 |
|------|----------|
| **Post** | `content` 纯文本；API 层限制 **最多 2000 字符**；`author_id` → `users` |
| **软删除** | `posts`、`comments` 使用 `deleted_at`；列表与 Feed **不返回**已删记录；作者可见「已删除」占位为可选 UX，API 默认 404 |
| **Like** | `UNIQUE (user_id, post_id)`；幂等：重复点赞返回成功或 409（实现时二选一并在 api-spec 固定） |
| **Follow** | `UNIQUE (follower_id, followee_id)`；`CHECK (follower_id <> followee_id)`；不可关注自己 |
| **Comment** | Phase 2 **扁平列表**（无楼中楼 `parent_id`）；单条 `content` 最多 **1000 字符** |
| **计数** | `posts.like_count`、`posts.comment_count` **反范式冗余**，在点赞/评论事务内 `±1` 更新，避免 Feed 热路径 `COUNT(*)` |

### 用户搜索（Phase 2 内）

- **引擎**：PostgreSQL **`pg_trgm`** 扩展 + `GIN` 索引
- **字段**：`users.username`、`profiles.display_name`（`ILIKE` / `similarity` 组合）
- **范围**：仅搜索**可发现用户**（未来 `blocks` 接入后排除被拉黑关系）
- **不分页算法推荐**；结果按相关度 + `username` 排序，cursor 分页

不引入 Elasticsearch / Meilisearch，直至 Profile 与 Post 全文检索成为瓶颈（Phase 4+ 再评审）。

## 原因

- 与 Phase 1 Drizzle 工作流一致，Agent 与开发者可复用同一套模式
- 文字 Post + 四表足以覆盖 roadmap 全部 Phase 2 功能
- `pg_trgm` 满足用户名搜索，无需新基础设施
- 冗余计数 + 软删除是社交平台常见、可测试的折中

## 权衡

- 反范式计数在并发下需事务或 `UPDATE ... RETURNING` 小心处理；极端不一致可后台校正（Phase 2 不实现）
- 扁平评论后期加 `parent_id` 需迁移 — 接受，Phase 2 刻意保持简单
- 无媒体意味着 Post 模型 Phase 4 要加 `media` 表或 JSONB 附件 — 预留 `posts` 不存 URL 字段，媒体走独立表

## 后续（Phase 2 实现顺序）

1. 更新 [db-schema.md](../db-schema.md) Phase 2 详表（本文档 Accepted 后已同步）
2. Drizzle schema + migration：`posts`、`comments`、`likes`、`follows`
3. `shared-types`：`Post`、`Comment`、`Like`、`Follow` 域类型
4. `api-spec.md` Phase 2 端点与分页约定（见 ADR 11）
5. Hono `routes/v1/posts.ts`、`comments`、`users`（follow/search）

## 相关

- [ADR 06](./06-database-choice.md)、[ADR 07](./07-orm-selection.md)
- [ADR 11 — Feed 时间线](./11-feed-timeline-strategy.md)
- [ADR 12 — Phase 2 客户端同步](./12-phase2-client-sync.md)
- [db-schema.md](../db-schema.md)、[api-spec.md](../api-spec.md)
