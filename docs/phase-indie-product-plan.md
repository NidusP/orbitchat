# 独立产品迭代计划（P1 / P2）

> **定位**：Orbitchat 的终极目标是**独立开发、可上线的社交产品**；Agent 工程、IM 系统设计、对象存储等是在交付过程中积累的能力，不是项目目的本身。  
> **日期**：2026-07-14  
> **基线**：`master` @ PR #7（暖色 UI、i18n、站内通知、图片上传 MVP）  
> **分支**：`feat/indie-p1-p2`

---

## 当前基线（已交付于 master）

| 能力 | 状态 |
|------|------|
| 用户 / Feed / 关注 / 搜索 | ✅ |
| 1:1 + 群聊 + WS + 群管理 | ✅ |
| 小轨 AI（FC / 记忆 / RAG / 摘要） | ✅ |
| 产品 Shell（Tab / i18n / 暗色 / onboarding） | ✅ |
| 站内通知（点赞 / 评论） | ✅ |
| 发帖配图 + 头像上传（S3/MinIO） | ✅ MVP |
| CI 流水线 | ⏸ 后续 |

---

## 并行执行模型

```
Docs sync ─────────────────────────────┐
                                       ├── 总验收
P1-A / P1-B / P1-C 并行（文件隔离） ──┤
P2-A / P2-B / P2-C 可与 P1 弱并行     ┘
       （迁移号串行：0020→0023）
```

| 轨道 | 主要文件归属 | 迁移 |
|------|--------------|------|
| P1-A 上传清理 | `upload-service.ts`、`index.ts` | — |
| P1-B 聊天发图 | `message-media`、`message-service`、conversations 路由、Web 会话页 | **0020** |
| P1-C 通知单测 | `notification-service.test.ts` | — |
| P2-A 群头像 | `conversations.avatarUrl`、group-member / conversation service、群设置页 | **0021** |
| P2-B 新消息通知 | `notification_type`、message-service 钩子、通知 UI | **0022** |
| P2-C 邮箱验证 | ADR 25、auth、`email-verification-service`、`/verify-email` | **0023** |

聊天发图决策记在 [ADR 23 v1.1](./decisions/23-object-storage-uploads.md)，**不单独建 ADR 24**。  
邮箱验证见 [ADR 25](./decisions/25-email-verification.md)。

**门禁**：`pnpm type-check` + `cd apps/server && bun test` 全绿；**CI 暂不纳入**。

---

## P1 — 生产就绪

| 轨道 | 交付物 | 验收状态 |
|------|--------|----------|
| **P1-A 上传清理** | `purgeExpiredPendingUploads`；启动 + 1h 定时；删 S3 + DB `deleted` | ✅（含 committed 不受影响断言） |
| **P1-B 聊天发图** | `purpose=message`；`message_media`；`uploadId`；Web 选图 | ✅ |
| **P1-C 通知单测** | 点赞/评论创建、列表、已读、自操作不通知 | ✅ |

## P2 — 产品完整度

| 轨道 | 交付物 | 验收状态 |
|------|--------|----------|
| **P2-A 群头像** | `avatar_url`；`purpose=group_avatar`；群设置上传 | ✅ |
| **P2-B 新消息通知** | `message_received`；DM 写通知；通知页跳转会话 | ✅ |
| **P2-C 邮箱验证** | ADR 25；开关默认关闭；验证 API + Web 页 | ✅ |

**P3 延后**：Web Push、Presence、WebRTC、视频上传、CI。

---

## 手测清单（合入前）

- [ ] 发帖纯文字 / 纯图 / 图文
- [ ] 头像 / 群头像
- [ ] DM 发图
- [ ] 点赞/评论/新消息通知
- [ ] i18n 切换、暗色主题
- [ ] 邮箱验证流程（`EMAIL_VERIFICATION_ENABLED=true` 时）
