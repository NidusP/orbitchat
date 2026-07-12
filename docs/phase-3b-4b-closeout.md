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

> **2026-07-11 更新**：上述「后续」项中 **群邀请链接、群公告、消息编辑/撤回** 已在 Post-3B/4B 迭代合入 `master`（见下文 §后续迭代）。

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

> **2026-07-11 更新**：M1 记忆 / M2 RAG / M3 摘要 / Wave 1–5 已在 [phase-4-orbit-guide-plan.md](./phase-4-orbit-guide-plan.md) 交付并合入 `master`（见下文 §后续迭代）。

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
4. **群邀请链接**：~~见 [phase-3b1-group-plan.md](./phase-3b1-group-plan.md) P1~~ → ✅ 已交付（`0009_group_invites`，2026-07-11）。

---

## 后续迭代（Post-3B/4B → `master`，2026-07-11）

原 3B+4B closeout 之后的 stacked PR #3–#5 已合入 `master`（`239f71c`）。本节补全迁移编号与交付范围，避免与 Wave 0–5 文档脱节。

### DB 迁移对照（0009–0016）

| 编号 | 文件 | 内容 |
|------|------|------|
| 0009 | `group_invites` | 群邀请链接（code、过期、使用次数） |
| 0010 | `message_edits_recalls` | 消息编辑 / 撤回记录表 |
| 0011 | `message_recalls_unique` | 撤回幂等唯一约束 |
| 0012 | `conversations.metadata_version` | 群元数据乐观锁版本 |
| 0013 | `conversations.announcement` | 群公告字段 |
| 0014 | `user_agent_memories` | M1 跨会话显式记忆 |
| 0015 | `ai_conversation_summaries` | M3 长聊摘要 |
| 0016 | `knowledge_chunks` | M2 RAG 向量索引（pgvector，无扩展时降级建表） |

本地 / CI 须执行 `pnpm --filter @orbitchat/server db:migrate`；Playwright 启动前迁移失败会**中断** E2E（不再 `|| true` 吞错）。

### API 健壮性 + 群扩展（PR #3）

- ADR 18–19：写操作幂等、乐观锁 / 悲观锁边界
- 群邀请：`POST /conversations/:id/invites`、公开 `GET /invites/:code`
- 群公告：与改群名共用 `metadata_version`
- 消息编辑 / 撤回（direct + group）

### Orbit Guide Wave 0–5（PR #4）

- Wave 1：平台感知 Tool（`my_profile`、`list_my_recent_posts` 等）
- Wave 2 M1：`remember_fact` + `user_agent_memories`
- Wave 3 M2：`search_my_posts` / `search_help_docs` + `knowledge_chunks`
- Wave 4 M3：长聊摘要注入
- Wave 5：记忆管理 UI、引用 chips、错误文案

详见 [phase-4-orbit-guide-plan.md](./phase-4-orbit-guide-plan.md)、[orbit-guide-agent-implementation.md](./orbit-guide-agent-implementation.md)。

### 测试加固（PR #5）

- Server：**217** tests（含 agent / RAG / postgres-errors）
- E2E：**37** tests（含 agent 记忆、RAG mock、`my_profile`）
- `postgres-errors`：识别 Drizzle 包装的 `42P01` / `42703`
- `0016` 迁移：无 pgvector 时仍建 `knowledge_chunks` 表（无 `embedding` 列）

### pgvector 降级（开发环境必读）

- **推荐**：`docker compose` 使用 `pgvector/pgvector:pg16`（见 `docker-compose.yml`）。
- **旧库**（如本机 `postgres:16-alpine` 容器 `im-postgres`）：`0016` 迁移成功但**无** `embedding` 列；写入索引会打日志失败，检索自动 **ILIKE 文本回退**（见 [env.md](./env.md) § RAG）。
- **恢复语义检索**：换 pgvector 镜像 → 手动 `CREATE EXTENSION vector` + `ALTER TABLE ... ADD COLUMN embedding vector(768)` → `bun scripts/reindex-rag.ts`。

### 验证记录（2026-07-11）

```bash
pnpm type-check
pnpm lint
pnpm --filter @orbitchat/server test          # 217 pass
CI=true pnpm e2e                               # 37 pass
pnpm --filter @orbitchat/server db:migrate     # 含 0009–0016
```

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
| ~~P1~~ | ~~群邀请链接（3B.1 P1）~~ | ✅ 已合 master |
| ~~P2~~ | ~~M1 记忆 / M2 RAG~~ | ✅ [phase-4-orbit-guide-plan.md](./phase-4-orbit-guide-plan.md) |
| P2 | Agent：SSE 真流式 / 云 API | 4B 余量 |
| P2 | Redis 多实例 WS | 部署前 |
| 远期 | 4C WebRTC、Fine-tuning | roadmap |

---

## 附：离「产品最终形态」快照（2026-07-07）

| 模块 | 状态 |
|------|------|
| 用户 / 社交 / 1:1 私聊 | ✅ |
| 群聊 + 群管理 + 私聊 typing | ✅ 本阶段 |
| 群邀请 / 公告 / 消息编辑撤回 | ✅ Post-3B/4B |
| AI Chat + 写 Tool + 井字棋 | ✅ 本阶段 |
| Orbit Guide Wave 0–5（记忆/RAG/摘要） | ✅ Post-3B/4B |
| 推送、4C 多媒体 | 📋 后续 |

**粗估**：P0–P1 主干约 **~80–85%**；UI 打磨、推送、4C 仍待做。
