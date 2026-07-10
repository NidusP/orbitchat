# API 健壮性审计 — `/api/v1/*`

> 原则见 [ADR 18](./decisions/18-api-robustness.md)。  
> **最后审计**：2026-07-07（57 个 endpoint，6 route 文件 + feed）

**图例**：✅ OK · ⚠️ PARTIAL（可接受/待统一）· ❌ GAP（已修复或待修复）

---

## 汇总

| 状态 | 数量 | 说明 |
|------|------|------|
| ✅ OK | 35+ | 校验完整或风险可接受 |
| ⚠️ PARTIAL | ~13 | 主要为 auth refresh 等非阻塞项 |
| ❌ GAP | 6 → **已修复** | 见下表 |

### 已修复 GAP（2026-07-07）

| Endpoint | 问题 | 修复 |
|----------|------|------|
| `POST /conversations` | 参与者不存在未校验 | `getUserById`；directKey 竞态重试 |
| `POST /conversations/:id/members` | 用户不存在未校验 | `getUserById` |
| `POST /conversations/invites/:code/accept` | `maxUses` 并发超限 | 条件原子 `UPDATE use_count` |
| `DELETE /conversations/:id/messages/:id` | 并发双撤回 | `WHERE deleted_at IS NULL` |
| `POST /ai/tool-calls/:id/approve` | 并发双批准 | `WHERE status = 'pending'` |
| `POST /posts/:id/like` | 并发双 like → 500 | `ON CONFLICT DO NOTHING` |
| `DELETE /posts/:id/comments/:commentId` | URL `postId` 未校验 | service 校验 `comment.postId` |

---

## auth（8）

| Method | Path | Status | 备注 |
|--------|------|--------|------|
| POST | `/register` | ✅ | 重复 email/username → 409 |
| POST | `/login` | ✅ | |
| POST | `/refresh` | ⚠️ | 并发 refresh 第二条可能 SESSION_REVOKED |
| DELETE | `/logout` | ✅ | 幂等 |
| POST | `/logout-all` | ✅ | |
| GET | `/sessions` | ✅ | |
| DELETE | `/sessions/:sessionId` | ⚠️ | 已 revoke 的他人 session → 404 |
| POST | `/sessions/trust` | ✅ | |

---

## users（10）

| Method | Path | Status | 备注 |
|--------|------|--------|------|
| GET | `/search` | ✅ | |
| GET | `/:id/profile` | ✅ | |
| PATCH | `/:id/profile` | ✅ | 未变字段 → 400 |
| GET | `/:id` | ✅ | inactive → 404 |
| GET | `/:id/posts` | ✅ | 未知/inactive user → 404 |
| POST | `/:id/follow` | ✅ | 幂等 |
| DELETE | `/:id/follow` | ✅ | 幂等 unlike |
| GET | `/:id/followers` | ✅ | |
| GET | `/:id/following` | ✅ | |
| PATCH | `/:id` | ✅ | 未变字段 → 400；冲突 → 409 |

---

## posts + feed（10）

| Method | Path | Status | 备注 |
|--------|------|--------|------|
| POST | `/posts` | ✅ | |
| GET | `/posts/:id` | ✅ | 软删 → 404 |
| PATCH | `/posts/:id` | ✅ | 内容未变 → 400；作者校验 |
| DELETE | `/posts/:id` | ✅ | 已删 → 400 |
| POST | `/posts/:id/like` | ✅ | 幂等 + ON CONFLICT |
| DELETE | `/posts/:id/like` | ✅ | 幂等 |
| GET | `/posts/:id/comments` | ✅ | |
| POST | `/posts/:id/comments` | ✅ | |
| DELETE | `/posts/:id/comments/:commentId` | ✅ | postId 归属；已删 → 400 |
| GET | `/feed/home` | ✅ | |

---

## ai（8）

| Method | Path | Status | 备注 |
|--------|------|--------|------|
| GET | `/agents` | ✅ | |
| GET | `/conversations` | ✅ | owner scope |
| POST | `/conversations` | ✅ | |
| GET | `/conversations/:id/messages` | ✅ | |
| GET | `/conversations/:id/tool-calls` | ✅ | |
| POST | `/tool-calls/:id/approve` | ✅ | pending 条件更新 |
| POST | `/tool-calls/:id/reject` | ✅ | pending 条件更新 |
| POST | `/conversations/:id/messages` | ✅ | Phase A：可预判错误 JSON 信封；运行中错误 SSE `error`（含 `timestamp`），见 [ADR 20](./decisions/20-ai-sse-streaming.md) |

---

## conversations（21）

| Method | Path | Status | 备注 |
|--------|------|--------|------|
| GET | `/` | ✅ | |
| POST | `/` | ✅ | 用户存在 + directKey 竞态 |
| GET | `/:id` | ✅ | |
| GET | `/:id/messages` | ✅ | 含 recalls |
| POST | `/:id/messages` | ✅ | |
| GET | `/:id/messages/:messageId/edits` | ✅ | |
| PATCH | `/:id/messages/:messageId` | ✅ | 时间窗、未变、已撤回 |
| DELETE | `/:id/messages/:messageId` | ✅ | 撤回时间窗、双撤回、条件 UPDATE |
| PATCH | `/:id/read` | ✅ | |
| PATCH | `/:id` | ✅ | 群名未变 → 400；version 冲突 → 409 |
| GET | `/:id/members` | ✅ | |
| POST | `/:id/members` | ✅ | 用户存在校验 |
| PATCH | `/:id/members/:userId` | ✅ | RBAC |
| DELETE | `/:id/members/:userId` | ✅ | |
| POST | `/:id/leave` | ✅ | |
| POST | `/:id/transfer-owner` | ✅ | |
| POST | `/:id/invites` | ✅ | |
| GET | `/:id/invites` | ✅ | |
| DELETE | `/invites/:code` | ✅ | 重复 revoke → 400 |
| GET | `/invites/:code` | ✅ | |
| POST | `/invites/:code/accept` | ✅ | maxUses 原子递增 |

---

## 待统一（PARTIAL  backlog）

非阻塞，后续迭代可选：

- PATCH 未变 / 二次 DELETE / inactive 用户：已统一（2026-07-08）✅
- AI SSE Phase B/C 真流式与 `tool.started`（[ADR 20](./decisions/20-ai-sse-streaming.md)）

---

## 新 endpoint 自检

合并 PR 前复制 [ADR 18](./decisions/18-api-robustness.md) 清单逐项打勾，并在本表追加一行。
