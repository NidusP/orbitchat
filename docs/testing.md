# 测试策略 — Orbitchat

> 单元测试 + E2E 共同保障；**每条功能至少覆盖 happy path + 关键边界 + 异常路径**。

**相关**：[coding-rules.md](./coding-rules.md)、[phase-2-closeout.md](./phase-2-closeout.md)、[CONTRIBUTING.md](../CONTRIBUTING.md)

---

## 原则

### 1. 三类路径都要测

| 类型 | 含义 | 例子 |
|------|------|------|
| **Happy path** | 正常输入、授权正确、资源存在 | 发帖成功、关注成功 |
| **边界** | 空值、长度上下限、分页游标、幂等重复操作 | 空正文 400、`limit` 超限、重复点赞 |
| **异常** | 未登录、无权限、资源不存在、非法 ID | 401 / 403 / 404、malformed UUID |

不要只测「能跑通」；**路由层**用单测快速覆盖异常信封，**E2E** 覆盖用户可见的关键失败态。

### 2. 分层职责

| 层 | 工具 | 测什么 |
|----|------|--------|
| **Service / lib** | Bun test（`*.test.ts`） | 纯逻辑、cursor 编解码、校验映射 |
| **HTTP 路由** | Bun test + mock service | 状态码、`code` 信封、Zod 校验、auth 中间件 |
| **Web 工具** | Bun test | API client、optimistic 更新、错误解析 |
| **端到端** | Playwright（`apps/web/e2e/*.spec.ts`） | 注册→Feed→社交主链路 + 少量 UI 级异常 |

E2E **不替代**单测：异常路径优先写在 server 单测，E2E 只保留「用户真的会碰到」的几条。

### 3. 新增功能时的检查清单

写 PR 前自问：

- [ ] Happy path 有测试（单测或 E2E 至少一处）？
- [ ] 401 / 403 / 404 / 400 中**适用**的至少测一种？
- [ ] 输入校验（空、过长、非法 UUID）测了？
- [ ] 错误响应是标准 `ErrorResponse` 信封（见 `error-envelope.test.ts`）？
- [ ] 改 API 后 `shared-types` 与 `api-spec.md` 已同步？

### 4. 命令

```bash
pnpm test              # 全 workspace 单测
pnpm --dir apps/server test
pnpm --dir apps/web test src
pnpm e2e               # Playwright（需 Postgres + migrate；勿与 pnpm dev 3000 冲突）
pnpm type-check && pnpm lint
```

**E2E 环境**：Docker `im-postgres` 运行 → `pnpm --dir apps/server db:migrate` → `pnpm e2e`（Playwright 自起 3100/3101）。

---

## 当前覆盖（Phase 1–2）

### 单测规模（约）

| 套件 | 文件 | 侧重 |
|------|------|------|
| server | `error-envelope.test.ts` | 各路由校验与错误信封 |
| server | `social.test.ts`、`users-social.test.ts` | 帖子 / 关注 / 搜索边界 |
| server | `auth.test.ts`、`users.test.ts` | 认证与用户 |
| web | `client.test.ts`、`errors.test.ts` | API client 与错误解析 |

### E2E 规模

| 文件 | 条数 | 侧重 |
|------|------|------|
| `auth-profile-flow.spec.ts` | 7 | 注册、登录失败、弱密码、Profile、Sessions |
| `social-flow.spec.ts` | 10+ | Feed、关注、评论、编辑删帖、粉丝页、空输入边界 |

具体数量以仓库内 `*.spec.ts` 为准；Closeout 文档中的数字可能滞后，**以 `pnpm e2e` 为准**。

### 已知缺口（可接受 / 待补）

- E2E：`/following` 页、用户自删评论、Unlike / 取消关注
- 单测：`follow-service` 与 DB 集成的 pg_trgm 查询（依赖 Postgres 扩展）
- 性能 / 压测：不在单测 E2E 范围，见 `sql-learning.md` 练习

---

## 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| 0.1.0 | 2026-07-02 | 初版：三类路径原则、分层、清单、Phase 1–2 覆盖 |
