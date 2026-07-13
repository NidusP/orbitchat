# ADR 23：对象存储与图片上传（Phase 4C MVP）

- **状态**：Accepted
- **日期**：2026-07-13
- **阶段**：Phase 4C（产品化上传 MVP）

## 背景

Phase 2 动态为纯文字（ADR 10）。产品化需要头像与动态配图。Roadmap Phase 4C 规划 S3 兼容对象存储；本地开发使用 **MinIO**，生产可自建 MinIO 或云 S3（同一 SDK）。

约束：

- 业务 REST 在 Hono，`/api/v1/*` 前缀
- 先 spec → shared-types → 实现
- TypeScript strict，禁止 `any`
- v1 **不做**聊天发图、视频、预签名直传、缩略图处理

## 选项

### 1. 客户端预签名直传 S3

- 优点：服务端不经由大文件
- 缺点：CORS、回调确认、客户端复杂度；MVP 过重

### 2. 服务端中转 multipart + S3 SDK

- 优点：统一鉴权与校验；与现有 Hono 中间件一致；E2E 可 mock
- 缺点：上传流量经 API 节点

### 3. Postgres BYTEA 存图

- 优点：无额外基础设施
- 缺点：违背 ADR 10 延后媒体策略；DB 膨胀

## 决策

采用 **选项 2**：`POST /api/v1/uploads` multipart 经服务端写入 S3 兼容存储；元数据表 `uploads` + `post_media`；媒体读取走 **`GET /api/v1/media/:uploadId`** 代理流（不公开 bucket）。

### 存储

| 项 | 值 |
|----|-----|
| SDK | `@aws-sdk/client-s3` |
| 开发 | Docker MinIO（`docker-compose.yml`） |
| Bucket | 单 bucket `orbitchat`（可配置） |
| Object key | `{purpose}/{userId}/{uploadId}.{ext}` |
| 开关 | `STORAGE_ENABLED`（`false` 时上传路由 503，现有 E2E 不受影响） |

### 限制

| purpose | MIME | 最大体积 |
|---------|------|----------|
| `avatar` | `image/jpeg`, `image/png`, `image/webp` | 5 MB |
| `post` | 同上 | 10 MB |

每帖最多 **4** 张图；`createPost` 的 `uploadIds` 须为本人 `pending` + `purpose=post`。

### 状态机

`pending` → `committed`（绑定帖子或头像）→ `deleted`（软删，对象可异步清理）

未提交的 `pending` 记录 `expires_at = created_at + 24h`（清理 job 可后续补）。

### API（概要）

见 [api-spec.md — Uploads & Media](../api-spec.md#uploads--media)。

- `POST /api/v1/uploads` — `multipart/form-data`: `file`, `purpose`
- `GET /api/v1/media/:uploadId` — 已 `committed` 可读；无需登录（UUID 不可猜测）
- `POST /api/v1/posts` — 扩展 `uploadIds?: string[]`；`content` 与 `uploadIds` 至少其一非空
- `PATCH /api/v1/users/me/profile` — 扩展 `avatarUploadId?: string`（与 `avatarUrl` 互斥，优先 uploadId）

### 不在 v1

- 聊天图片消息
- 视频 / 音频
- 预签名 URL
- 图片裁剪 / 多尺寸

## 后果

- 本地需 `pnpm docker:up` 含 MinIO，或 `STORAGE_ENABLED=false` 跳过
- Feed / Post DTO 增加 `media: PostMediaItem[]`
- 头像 URL 从外链改为 `/api/v1/media/{id}` 或保留兼容旧外链

## 验收标准

1. MinIO 容器 healthy；`STORAGE_ENABLED=true` 时可上传
2. 发帖带 1–4 图，Feed / 详情展示图片
3. 个人资料页可换头像并展示
4. 非 owner 不可用他人 `uploadId` 发帖
5. 单测：upload 校验、post+media、profile avatar
6. 现有 E2E 38 条仍全绿（`STORAGE_ENABLED=false` 默认测试环境）
