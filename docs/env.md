# 环境变量 - Orbitchat

本文档列出各 app 的环境变量。本地开发可复制根目录 `.env.example`（Phase 1 实现时创建）到 `.env`。

**安全**：`.env` 不得提交 git；密钥仅放本地或 CI Secret。

---

## 快速参考

| 变量 | App | 必填 | 说明 |
|------|-----|------|------|
| `DATABASE_URL` | server | Phase 1+ | PostgreSQL 连接串 |
| `JWT_SECRET` | server | Phase 1+ | Access JWT 签名密钥 |
| `JWT_ACCESS_TTL` | server | 否 | 默认 `15m` |
| `JWT_REFRESH_TTL` | server | 否 | 默认 `30d` |
| `PORT` | server | 否 | 默认 `3001` |
| `NODE_ENV` | server | 否 | `development` / `production` |
| `CORS_ORIGIN` | server | 否 | 默认 `http://localhost:3000` |
| `LLM_BASE_URL` | server | Phase 4A | 本地模型 OpenAI-compatible API 基址 |
| `LLM_API_KEY` | server | 否 | 云模型或网关的 Bearer Token（可选） |
| `LLM_MODEL` | server | Phase 4A | 默认模型名 |
| `LLM_TIMEOUT_MS` | server | 否 | LLM 请求超时，默认 `30000` |
| `LLM_E2E_MOCK` | server | 否 | Playwright E2E 专用；`true` 时用确定性 mock 替代 Ollama |
| `AI_MAX_CONCURRENT_RUNS` | server | 否 | AI 并发运行数，默认 `2` |
| `EMBEDDING_MODEL` | server | 否 | RAG embedding 模型名，默认 `nomic-embed-text` |
| `EMBEDDING_DIMENSIONS` | server | 否 | 向量维度，默认 `768`（须与 `knowledge_chunks.embedding` 一致） |
| `RAG_ENABLED` | server | 否 | 是否启用 RAG 索引/检索，默认 `true` |
| `STORAGE_ENABLED` | server | 否 | 对象存储开关，默认 `false`（E2E/单测）；`true` 启用上传 |
| `S3_ENDPOINT` | server | STORAGE 时 | S3 API 端点，MinIO 例 `http://localhost:9000` |
| `S3_REGION` | server | 否 | 默认 `us-east-1` |
| `S3_ACCESS_KEY` | server | STORAGE 时 | |
| `S3_SECRET_KEY` | server | STORAGE 时 | |
| `S3_BUCKET` | server | 否 | 默认 `orbitchat` |
| `NEXT_PUBLIC_API_URL` | web | 是 | Hono API 基址 |
| `NEXT_PUBLIC_APP_VERSION` | web | 否 | 客户端 semver，Header 用 |

---

## apps/server

### `DATABASE_URL`

PostgreSQL 连接字符串（[ADR 06](./decisions/06-database-choice.md)）。

```bash
# 本地 Docker 示例
DATABASE_URL=postgresql://orbitchat:orbitchat@localhost:5432/orbitchat
```

### `JWT_SECRET`

Access Token JWT 签名密钥。**至少 32 字节随机字符串**。

```bash
# 生成示例（勿用于生产）
openssl rand -base64 32
```

生产使用独立密钥并定期轮换（需配合 refresh 与 session 策略）。

### `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL`

| 变量 | 默认 | 说明 |
|------|------|------|
| `JWT_ACCESS_TTL` | `15m` | Access JWT 有效期 |
| `JWT_REFRESH_TTL` | `30d` | Session / Refresh 有效期；「保持登录」可调为 `7d` 等 |

### `PORT`

HTTP 监听端口。默认 `3001`。

### `CORS_ORIGIN`

允许的前端 Origin，逗号分隔。开发：

```bash
CORS_ORIGIN=http://localhost:3000
```

### `NODE_ENV`

`development` | `test` | `production`。影响日志级别、Cookie `Secure` 等。

### Refresh Cookie（Phase 1 代码内配置，非 env）

| 属性 | 开发 | 生产 |
|------|------|------|
| `HttpOnly` | true | true |
| `Secure` | false（localhost） | true |
| `SameSite` | Lax | Lax |
| `Path` | `/api/v1/auth` | 同上 |

### AI / LLM（Phase 4A）

Phase 4A 通过 OpenAI-compatible HTTP API 接入本地模型服务。推荐先使用 Ollama：

```bash
LLM_BASE_URL=http://localhost:11434/v1
LLM_API_KEY=
LLM_MODEL=llama3.2
LLM_TIMEOUT_MS=30000
AI_MAX_CONCURRENT_RUNS=2
```

说明：

- `LLM_BASE_URL` 不应包含 `/chat/completions`，代码会自动拼接。
- `LLM_API_KEY` 可留空；配置后会以 `Authorization: Bearer <key>` 请求模型服务。
- `LLM_MODEL` 需要与本地模型服务中已拉取的模型名一致。
- `LLM_TIMEOUT_MS` 到期后 AI route 返回明确错误，不影响普通 REST / WebSocket。
- `AI_MAX_CONCURRENT_RUNS` 是单进程内并发保护；多实例部署时需要额外队列或限流。

### RAG / Embedding（Wave 3 M2）

```bash
EMBEDDING_MODEL=nomic-embed-text
EMBEDDING_DIMENSIONS=768
RAG_ENABLED=true
```

说明：

- Embedding 请求发往 `{LLM_BASE_URL}/embeddings`（与聊天共用 OpenAI-compatible 基址）。
- 本地 Ollama 示例：`ollama pull nomic-embed-text`，`EMBEDDING_MODEL=nomic-embed-text`。
- `EMBEDDING_DIMENSIONS` 须与 migration `knowledge_chunks.embedding vector(N)` 一致；改维度需新 migration 并重建索引。
- `RAG_ENABLED=false` 关闭索引与检索（运维开关）；表结构仍可通过 migration 存在。
- **`LLM_E2E_MOCK=true`** 时，embedding 使用 **确定性 hash 向量**（`HashMockEmbeddingProvider`），不调用 Ollama embedding API，保证 Playwright E2E 可重复。

---

## apps/web

### `NEXT_PUBLIC_API_URL`

浏览器访问的 Hono API 基址（**无**尾部斜杠）。

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### `NEXT_PUBLIC_APP_VERSION`

发送 `X-Client-Version` Header。默认可在代码中 fallback `0.0.0`。

---

## 本地开发最小集（Phase 1）

**server**（`apps/server/.env`）：

```bash
DATABASE_URL=postgresql://orbitchat:orbitchat@localhost:5432/orbitchat
JWT_SECRET=dev-only-change-me-use-openssl-rand
PORT=3001
CORS_ORIGIN=http://localhost:3000
NODE_ENV=development
LLM_BASE_URL=http://localhost:11434/v1
LLM_MODEL=llama3.2
LLM_TIMEOUT_MS=30000
AI_MAX_CONCURRENT_RUNS=2
EMBEDDING_MODEL=nomic-embed-text
EMBEDDING_DIMENSIONS=768
RAG_ENABLED=true
```

**web**（`apps/web/.env.local`）：

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_VERSION=0.1.0
```

---

## Docker Compose（本地开发）

一键启动 Postgres + Redis（Phase 1 仅需 Postgres；Redis 预置供 Phase 3+）：

```bash
cp .env.example .env          # 可选，默认凭据已写在 compose 中
pnpm docker:up                # 或 docker compose up -d
pnpm docker:logs              # 查看日志
pnpm docker:down              # 停止容器
pnpm docker:reset             # 停止并删除数据卷（清空 DB）
```

| 服务 | 端口 | 说明 |
|------|------|------|
| postgres | 5432 | Phase 1 必需；镜像 `pgvector/pgvector:pg16`（Wave 3 RAG 需 `vector` 扩展） |
| redis | 6379 | Phase 3+ 可选（Session 缓存 / Pub-Sub） |

启动后配置 `apps/server/.env`：

```bash
DATABASE_URL=postgresql://orbitchat:orbitchat@localhost:5432/orbitchat
```

迁移：

```bash
cd apps/server && pnpm db:migrate
```

配置文件：根目录 [`docker-compose.yml`](../docker-compose.yml)。

### 对象存储（Phase 4C，可选）

本地开发上传功能需 MinIO + `STORAGE_ENABLED=true`：

```bash
STORAGE_ENABLED=true
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=orbitchat
```

MinIO 随 `pnpm docker:up` 启动（见根目录 `docker-compose.yml`）。控制台：http://localhost:9001

E2E / 默认单测环境保持 `STORAGE_ENABLED=false`（或未设置），上传路由返回 `503 SERVICE_UNAVAILABLE`。

### 端口冲突

若 `pnpm docker:up` 报 `Bind for 0.0.0.0:5432 failed: port is already allocated`：

1. 查看占用：`docker ps --format 'table {{.Names}}\t{{.Ports}}'`
2. **常见**：本机另有 `im-postgres` / 旧 Postgres 占 5432；`im-redis` 占 6379
3. **处理**（二选一）：
   - 停止/删除冲突容器后重试 `pnpm docker:up`
   - 或改 `docker-compose.yml` 端口映射（如 `"5433:5432"`）并同步 `apps/server/.env` 的 `DATABASE_URL`

若现有 `im-postgres` 已不再服务其他项目，也可以**直接复用该实例**：

1. 在 `im-postgres` 中创建独立的 `orbitchat` 用户与数据库
2. 保持 `apps/server/.env` 中 `DATABASE_URL=postgresql://orbitchat:orbitchat@localhost:5432/orbitchat`
3. 运行 `cd apps/server && pnpm db:migrate`

这种做法适合本机已有历史开发容器、且你接受共享 Docker 实例但希望保留**独立数据库**的场景。

清理失败的 Orbitchat 容器后重试（若曾使用旧命名 `orbitchat-*`）：

```bash
docker rm -f orbitchat-postgres orbitchat-redis 2>/dev/null || true
pnpm docker:up
```

**Compose 默认容器名**：`im-postgres`、`im-redis`（与常见本机实例一致）。若同名容器已在运行，不要重复 `docker compose up` postgres/redis，直接复用现有实例即可。

### 本地开发测试账号（非生产）

| 账号 | Email | Username | Password |
|------|-------|----------|----------|
| 测试账号 1 | `test@test.com` | `test_popolus` | `Password123!` |
| 测试账号 2 | `test2@test.com` | `test_popolus2` | `Password123!` |

- Web **Login** 页在 `NODE_ENV=development` 时显示两个 **一键登录** 按钮，便于双浏览器私聊收发测试。
- 忘记密码或账号不存在时初始化：

```bash
pnpm --dir apps/server db:reset-dev-user
```

（创建缺失账号并重置上述密码的 bcrypt hash。）

---

## CI

CI 中使用 Repository Secrets，命名与上表一致。测试库可用独立 `DATABASE_URL` 指向 ephemeral Postgres。

---

## 维护

新增环境变量时：

1. 更新本文档
2. 更新 `.env.example`（实现时）
3. 在 PR 描述中说明

---

## 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| 0.1.0 | 2026-06-14 | Phase 1 前置 env 清单 |
| 0.1.1 | 2026-06-14 | 添加 docker-compose.yml 与 pnpm docker:* 脚本 |
| 0.1.2 | 2026-06-14 | 补充端口冲突排查（5432/6379） |
| 0.1.3 | 2026-06-20 | 补充复用现有 `im-postgres` 的本地开发路径 |
| 0.2.0 | 2026-07-03 | 增加 Phase 4A 本地模型 AI 配置 |
