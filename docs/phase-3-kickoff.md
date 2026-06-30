# Phase 3 启动评审（Kickoff Review）

> **日期**：2026-06-30  
> **结论**：**不需推翻 Phase 3 目标**，建议 **拆分里程碑 + 补 ADR + 扩写 realtime-spec**，再写代码。

---

## 1. 现状（Phase 2 完成后）

| 已有能力 | 对 Phase 3 的意义 |
|----------|-------------------|
| Session + JWT + 多端 | WS 握手可复用同一套校验 |
| REST `/api/v1/*` 规范 | 聊天历史、会话列表继续走 REST |
| ADR 12：Phase 2 无 WS | **边界清晰**：Phase 3 才引入长连接 |
| Docker Compose 已有 Redis | 多实例 Pub/Sub **可选**，非 Day 1 阻塞 |
| `realtime-spec.md` 骨架 | 需从占位升级为 **可实现的契约** |

---

## 2. 原 roadmap 是否合理？

**总体：合理，但一次做满会范围蠕变。**

原 Phase 3 打包了：

- 1:1 私聊
- 群聊
- 未读/已读
- 离线推送（FCM/APNs）
- 在线/正在输入（可选）
- `session.revoked` WS

对学习项目，**建议拆成两个里程碑**，而不是改产品愿景。

---

## 3. 推荐重设计：里程碑拆分（非改方向）

### Phase 3A — 私聊 MVP（建议 3–4 周）

| 项 | 范围 |
|----|------|
| 数据 | `conversations`、`messages`（1:1） |
| REST | 创建会话、拉历史（cursor）、发消息（写入 + 返回） |
| WS | `WS /ws/v1/chat`：连接、`message.new` 推送、`message.ack` |
| Web | 会话列表 + 聊天窗 |
| 已读 | **简化**：仅 `last_read_at` per 会话，不做逐条已读回执 |
| 不做 | 群聊、FCM/APNs、typing、presence |

**成功标准**：两用户 Web 端 **< 1s** 收到对方消息；刷新后历史完整。

### Phase 3B — 群聊与增强（建议 +2–3 周）

| 项 | 范围 |
|----|------|
| 数据 | `chat_groups`、`chat_group_members`、群消息 |
| REST | 建群、邀请、踢人、群历史 |
| WS | 房间 `roomId = groupId` |
| 可选 | `typing.started` / `typing.stopped` |
| 可选 | `session.revoked` WS（ADR 08 已预留） |

### Phase 3.1 / 延后 — 推送与未读产品化

| 项 | 说明 |
|----|------|
| FCM / APNs | 独立 ADR；学习项目可 mock 或仅文档 |
| 通知中心 | 与 Phase 2 延后项合并规划 |
| 逐条已读回执 | 需要时再建 `message_reads` 表 |

---

## 4. 必须在编码前定的 ADR（Phase 3A 前）

| ADR | 议题 | 建议倾向 |
|-----|------|----------|
| **ADR 13** | WebSocket 实现 | **Bun.serve + Hono WS**；单进程先不做 Redis |
| **ADR 14** | 消息写入与投递 | **REST POST 持久化 + WS 广播**；在线直连，离线靠拉取 |
| **ADR 15** | 会话模型 | 1:1 用 `conversation` + 两成员；群 Phase 3B 再加 |

多实例 Redis Pub/Sub：**ADR 13 权衡里记录**，Phase 3A 不实现。

---

## 5. `realtime-spec.md` 需补全的内容（Phase 3A 开写前）

- [ ] 连接生命周期（鉴权、心跳、重连、断线）
- [ ] `message.new` / `message.ack` **完整 payload**（对齐 `shared-types`）
- [ ] 错误帧格式
- [ ] 与 REST 发消息的时序图（谁先发 WS、谁兜底）
- [ ] 单连接 per Session 还是 per User（建议 **per Session**）

---

## 6. `db-schema` 预览（3A）

```
conversations
  id, created_at, updated_at

conversation_members
  conversation_id, user_id, last_read_at, joined_at
  UNIQUE(conversation_id, user_id)

messages
  id, conversation_id, sender_id, content, created_at
  INDEX(conversation_id, created_at DESC)
```

群表 Phase 3B 再展开，避免一次迁移过大。

---

## 7. 与 Phase 2 的衔接

- Feed **继续 REST 轮询**（ADR 12），Phase 3 **不**给 Feed 加 WS
- 用户关系：聊天前是否必须互关？**建议 Phase 3A：任意两用户可开 1:1**（简单）；拉黑 `blocks` 接入后再过滤
- 搜索/Profile 已有，聊天入口从 Profile 或新 `/messages` 进

---

## 8. 决策摘要

| 问题 | 答案 |
|------|------|
| Phase 3 方向要不要改？ | **不要改**，拆 3A / 3B |
| 要不要上 Redis？ | 3A **不上**；文档预留 |
| 推送要不要进 3A？ | **不要**，延后 |
| 群聊和私聊一起做？ | **不要**，先 1:1 |
| realtime-spec 够不够？ | **不够**，先扩写再编码 |

---

## 9. 建议的下一步（Phase 3 启动顺序）

1. 接受本评审 → 更新 `roadmap.md` Phase 3 为 3A / 3B
2. 撰写 ADR 13–15（可合并为 2 篇）
3. 定稿 `realtime-spec.md` + `db-schema` Phase 3A 表
4. `shared-types` → WS + messages API
5. 实现 3A（WS + Web 聊天窗）

---

## 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| 0.1.0 | 2026-06-30 | Phase 2 收尾后初评；建议 3A/3B 拆分 |
