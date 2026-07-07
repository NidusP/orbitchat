# Phase 3B + 4B 计划

> **分支**：`feat/phase-3b-4b`  
> **前置**：3A 私聊 + 4A AI + 4B `send_dm` 已合并 `master`  
> **回顾**：[phase-3-agent-closeout.md](./phase-3-agent-closeout.md)

两条线 **并行** 推进，同分支提交即可。

---

## 并行一：群聊（3B）

| # | 任务 | 产出 |
|---|------|------|
| 1 | ADR 16 群聊模型 | `docs/decisions/16-group-chat-model.md` |
| 2 | `db-schema` / `api-spec` / `shared-types` | 群聊契约 |
| 3 | Migration + 后端 API + WS | `conversation-service`、`message-service` |
| 4 | Web UI | 建群、群列表、群聊窗（`/messages`） |
| 5 | （可选）typing 指示器 | `realtime-spec` + WS 事件 |

**验收**：≥2 用户在群内互发消息；刷新后历史正确；与 1:1 会话共存。

---

## 并行二：Agent Tool（4B 扩展）

| # | 任务 | 产出 |
|---|------|------|
| 1 | Tool schema 设计 | `api-spec` + `shared-types` |
| 2 | `create_post` Tool | pending → Approve → 写入 Feed |
| 3 | `follow` / `unfollow` Tool | pending → Approve → Phase 2 follow |
| 4 | （可选）SSE 真流式 | provider `stream: true` |
| 5 | （可选）`LLM_API_KEY` | `env` + 云 API 文档 |

**验收**：`/ai` 触发写 Tool → 确认卡片 → Feed / 关注列表可见。

复用现有 `send_dm` 模式：`ai_tool_calls` + Approve UI。

---

## 汇合（两线已完成 → 已合入 master）

- [x] E2E：群聊 + 群管理 + typing + Agent Tool + 井字棋
- [x] `pnpm type-check` / `lint` / server test（109）/ e2e（28）
- [x] 更新 `product.md`、`roadmap.md`、`AGENTS.md`
- [x] [phase-3b-4b-closeout.md](./phase-3b-4b-closeout.md)
- [x] PR → `master`（2026-07-07）

---

## 本阶段不做

Redis 多实例、3.1 推送、4C WebRTC、RAG / LangGraph。

---

## 本地速查

```bash
git checkout feat/phase-3b-4b
pnpm dev
pnpm --dir apps/server db:reset-dev-user   # test_popolus + test_popolus2
```
