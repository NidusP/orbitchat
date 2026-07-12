# Phase 3B + 4B Closeout

> **状态**：✅ 已交付；自动化测试通过；已合入 `master`  
> **日期**：2026-07-07  
> **分支**：`feat/phase-3b-4b` → `master`  
> **手测**：本阶段跳过 Ollama 自然语言 FC 手测；待 UI 改版后做整体功能验收

---

## 交付范围

本阶段在 [phase-3-agent-closeout.md](./phase-3-agent-closeout.md) 基础上，并行交付 **Phase 3B 群聊（含 3B.1 群管理 + 3A.1 私聊 typing）** 与 **Phase 4B Agent Tool 扩展（Function Calling + 井字棋）**。

### Phase 3B：群聊 + 管理 + 私聊 Typing

- [ADR 16](./decisions/16-group-chat-model.md)：`conversations.type = 'group'`。
- Migrations：`0006_group_chat`、`0007_group_member_roles`。
- 群聊：建群、群消息、列表、与 1:1 共用 REST / WS。
- **群管理（3B.1 P0）**：`owner` / `admin` / `member`；加人、踢人、退群、转让群主、改群名；`/messages/[id]/settings`。
- **私聊 typing（3A.1）**：`typing.started` / `typing.stopped`（仅 direct，群聊不做 typing）。
- Web：`/messages/new-group`、群设置页、typing 指示器。

**本阶段未做（后续）**：群邀请链接、presence、群头像、群公告、消息编辑/删除。

### Phase 4B：Agent Tool + 井字棋

- **架构**：OpenAI-compatible **Function Calling** + `AgentOrchestrator` tool loop（最多 5 轮）。
- **工具清单**：

| 工具 | 类型 | 执行方式 |
|------|------|----------|
| `search_contact` | 只读 | 立即执行 |
| `play_tictactoe` | 娱乐 | 立即执行；用户 X / AI O；对局持久化 |
| `send_dm` | 写 | pending → Approve |
| `create_post` | 写 | pending → Approve |
| `follow_user` / `unfollow_user` | 写 | pending → Approve |

- **井字棋**：`play_tictactoe`（start/status/move）；`ai_conversations.tictactoe_data` 存当前盘与历史；终局后可「再来一局」；`start` 返回 `matchHistory` 供 LLM 自由发挥。
- **E2E mock**：`LLM_E2E_MOCK=true`；前缀 `[e2e:create_post]`、`[e2e:follow_user]`、`[e2e:tictactoe]`、`[e2e:tictactoe:N]`。
- Web `/ai`：pending 卡片、井字棋棋盘组件。

**本阶段未做（4B 可选 / 后续）**：SSE 真流式、云 `LLM_API_KEY`、M1 长期记忆 / RAG（见 [phase-4-agent-memory-rag-plan.md](./phase-4-agent-memory-rag-plan.md)）。

---

## 验证记录（2026-07-07）

```bash
pnpm type-check
pnpm lint
pnpm --filter @orbitchat/server test          # 109 pass
CI=true pnpm e2e                               # 28 pass
pnpm --filter @orbitchat/server db:migrate     # 含 0006–0008
```

### Server 测试（节选）

- `conversations.test.ts`：群聊路由、群管理 API
- `group-member-service.test.ts`、`typing-service.test.ts`
- `tool-executor.test.ts`：写工具 + `play_tictactoe` + 对局归档
- `tic-tac-toe.test.ts`、`e2e-mock.test.ts`

### E2E（`chat-agent-flow.spec.ts` 等，共 28）

| 用例 | 说明 |
|------|------|
| 1:1 私聊 + typing | WS 实时消息与输入指示 |
| 群聊互发 | 建群 → 互发消息 |
| 群管理 | 改名、加人、踢人、转让、退群、owner 不可直接退群 |
| Agent `create_post` | E2E mock → Approve → Feed |
| 井字棋 | `[e2e:tictactoe]` 开局 + 落子 |

---

## 已知限制

1. **小模型 FC**：`llama3.2` 等可能只回文字不调工具；E2E 用 mock 覆盖。
2. **UI**：功能优先，整体 UI 改版与手测留待后续迭代。
3. **多实例 WS**：单进程 ChatHub；Redis Pub/Sub 未接。
4. **群邀请链接**：见 [phase-3b1-group-plan.md](./phase-3b1-group-plan.md) P1。

---

## 关键文件索引

```
docs/decisions/16-group-chat-model.md
apps/server/drizzle/0006_group_chat.sql
apps/server/drizzle/0007_group_member_roles.sql
apps/server/drizzle/0008_ai_tictactoe_data.sql
apps/server/src/services/group-member-service.ts
apps/server/src/services/typing-service.ts
apps/server/src/lib/agent-runtime/tic-tac-toe.ts
apps/server/src/lib/agent-runtime/tic-tac-toe-repository.ts
apps/server/src/lib/agent-runtime/tools.ts
apps/server/src/services/ai/tool-executor.ts
apps/web/src/app/messages/[id]/settings/page.tsx
apps/web/src/components/tic-tac-toe-board.tsx
apps/web/e2e/chat-agent-flow.spec.ts
```

---

## 下一步（合入 master 之后）

| 优先级 | 方向 | 文档 |
|--------|------|------|
| P0 | UI 改版 + 整体功能手测 | 用户主导 |
| P1 | 群邀请链接（3B.1 P1） | [phase-3b1-group-plan.md](./phase-3b1-group-plan.md) |
| P2 | Agent：SSE 真流式 / 云 API | 4B 余量 |
| P2 | Redis 多实例 WS | 部署前 |
| 远期 | M1 记忆 / M2 RAG / 4C WebRTC | [phase-4-agent-memory-rag-plan.md](./phase-4-agent-memory-rag-plan.md)、roadmap |

---

## 附：离「产品最终形态」快照（2026-07-07）

| 模块 | 状态 |
|------|------|
| 用户 / 社交 / 1:1 私聊 | ✅ |
| 群聊 + 群管理 + 私聊 typing | ✅ 本阶段 |
| AI Chat + 写 Tool + 井字棋 | ✅ 本阶段 |
| 推送、4C 多媒体、M1 记忆 | 📋 后续 |

**粗估**：P0–P1 主干约 **~70–75%**；UI 打磨、推送、4C、长期记忆仍待做。
