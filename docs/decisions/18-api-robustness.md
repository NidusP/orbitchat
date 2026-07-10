# ADR 18：API 接口健壮性

## 背景

Orbitchat 的 REST API 是 Web、未来移动端与 Agent 工具的共同边界。**不能假设**调用方一定经过 UI 校验，或只走 happy path。并发、重试、恶意/过期请求在真实环境中都会出现。

项目初期侧重功能交付；Phase 3B+ 起（消息编辑/撤回等）开始在 service 层落实规则。本 ADR 将原则制度化，并作为后续 endpoint 的验收标准。

## 决策

**所有 `/api/v1/*` 写操作必须在 Service 层做权威校验**；Route 层负责 Zod 格式校验与 auth；UI 只做体验优化，不可替代 API。

### 分层职责

```
UI        → 防误触、即时反馈（禁用按钮、本地校验）
Route     → Zod、UUID 格式、auth middleware
Service   → 业务状态、权限、时间窗、幂等/重复操作语义
DB        → 唯一约束、外键、条件 UPDATE（并发兜底）
```

### 必查清单（每个写 endpoint）

| # | 检查项 | 示例 |
|---|--------|------|
| 1 | **资源存在** | 用户/帖子/消息不存在 → `404` |
| 2 | **状态合法** | 已撤回消息不可再撤回/编辑 → `400 VALIDATION_ERROR` |
| 3 | **权限** | 仅发送者/作者/owner → `403 FORBIDDEN` |
| 4 | **无意义操作** | 编辑内容未变 → `400`（非静默 `200`） |
| 5 | **空 payload** | 空数组、空字符串 → Zod `400` |
| 6 | **幂等语义** | 文档化：重复 like 返回 `200`；重复撤回返回 `400` |
| 7 | **并发安全** | 条件 `WHERE status = 'pending'` / `ON CONFLICT DO NOTHING` |
| 8 | **路径一致** | URL 中的 `postId` 须与资源归属一致 |

### 错误码约定

- `400 VALIDATION_ERROR` — 状态不允许、内容未变、已处理过
- `403 FORBIDDEN` — 无权限
- `404 NOT_FOUND` — 资源不存在（含路径 ID 不匹配时故意用 404 防枚举）
- `409 CONFLICT` — 明确「资源冲突」（如 username 已占用、**协作编辑 version 过期**）

客户端应依赖 `code` 字段分支，不依赖英文 `message` 文案。

### 测试要求

每个写 endpoint 至少覆盖：

1. Happy path
2. 一种权限/状态拒绝（403 或 400）
3. 一种资源不存在（404）——若适用

详见 [testing.md](../testing.md) 与 [api-robustness-audit.md](../api-robustness-audit.md)。

## 权衡

- 更严格校验 → 更多 `400` 响应与测试维护成本
- 部分 PARTIAL 项（如帖子二次删除返回 `404` vs 幂等 `200`）可分期统一，但须在 spec 中写清

## 后续

1. 新 endpoint 合并前对照清单自检
2. 存量 GAP 按 [api-robustness-audit.md](../api-robustness-audit.md) 逐项修复
3. `AGENTS.md` / `coding-rules.md` 引用本 ADR

## 相关

- [api-spec.md](../api-spec.md) — HTTP 契约
- [api-robustness-audit.md](../api-robustness-audit.md) — 全量 endpoint 审计表
- [05-doc-first.md](./05-doc-first.md)
