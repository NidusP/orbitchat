# 产品定义 - Orbitchat

## 项目愿景

Orbitchat 是一个**学习型社交应用**（练习 → 案例项目），目标是通过构建完整的、生产级别的社交应用，学习现代全栈 TypeScript 开发和 AI 协作开发（Agentic Engineering）。

本项目不是一次性产品，而是一个**长期演进的学习项目**，会随着技术深入和业务理解逐步迭代。

**技术底座**：Next.js + Hono.js 的 pnpm workspace 全栈 Monorepo。

---

## 产品核心目标

### 长期目标（完整社交平台）

| 功能模块 | 描述 | 优先级 | 阶段 |
|---------|------|--------|------|
| **用户系统** | 注册、登录、个人资料、设置 | P0 | Phase 1 |
| **社交关系** | 关注/粉丝、推荐、搜索、黑名单 | P1 | Phase 2 |
| **个人动态** | 发布、编辑、删除帖子（Feed） | P1 | Phase 2 |
| **文字聊天** | 一对一在线文字聊天、消息推送 | P1 | Phase 3 | ✅ **3A 已完成** |
| **群组聊天** | 群聊创建、成员管理、群消息 | P1 | Phase 3 | ✅ **3B 已完成**（邀请链接待 3B.1） |
| **实时音视频** | 一对一/群组语音视频通话（WebRTC 信令） | P2 | Phase 4 | 📋 4C 待做 |
| **通知系统** | 关注、评论、点赞、聊天、通话通知 | P1 | Phase 2–3 | 部分（2 内互动；3.1 推送未做） |
| **AI Chat** | 与 AI 助手对话（个人助手 / 社交场景） | P2 | Phase 4 | ✅ **4A+4B**（FC 写工具 + 井字棋） |
| **个人橱窗** | 用户商品展示与交易（类轻量商城） | P2 | Phase 4–5 |
| **多媒体** | 图片、视频上传和处理 | P2 | Phase 4 |
| **数据分析** | 用户行为分析、内容热度 | P3 | Phase 5+ |

> **个人橱窗说明**：区别于「个人主页 Feed」，橱窗是独立的商品展示模块。因交易、库存等逻辑较重，未来可能以 **Go 或其他语言** 实现独立微服务，由 Hono API 网关聚合（详见 `docs/architecture.md` 扩展路径）。

### 当前阶段（2026-07-07）

**Phase 1–2、3A、3B、4A、4B 已交付**（见 [phase-3b-4b-closeout.md](./phase-3b-4b-closeout.md)）。

| 已交付 | 说明 |
|--------|------|
| Phase 1–2 | 用户、社交 Feed |
| **Phase 3A** | 1:1 私聊 + WS |
| **Phase 3B** | 群聊、群管理、私聊 typing |
| **Phase 4A** | AI Chat（小轨）、SSE |
| **Phase 4B** | FC 写工具 + `play_tictactoe` |

| 下一步 | 文档 |
|--------|------|
| UI 改版 + 整体手测 | 用户主导 |
| **小轨完善（平台感知 → 记忆 → RAG）** | **[phase-4-orbit-guide-plan.md](./phase-4-orbit-guide-plan.md)** |
| 3B.1 群邀请链接 | 已在分支实现，待合 master |
| M1/M2/M3 技术深描 | [phase-4-agent-memory-rag-plan.md](./phase-4-agent-memory-rag-plan.md) |
| 4C 音视频 / 多媒体 | roadmap |

**交付回顾**：[phase-3b-4b-closeout.md](./phase-3b-4b-closeout.md)

---

## 技术栈决策

详见 ADR：[02-backend-framework.md](./decisions/02-backend-framework.md)、[03-frontend-framework.md](./decisions/03-frontend-framework.md)、[01-monorepo-strategy.md](./decisions/01-monorepo-strategy.md)。

#### 后端：Bun + Hono

- Bun：原生 TS、高性能运行时
- Hono：轻量、类型安全、支持 WebSocket（聊天/信令）

#### 前端：Next.js 14+ App Router

- 业务 API 由 Hono 提供，Next 不承载核心 REST（见 ADR 03）

#### Monorepo：pnpm workspace

- 共享类型与工具，多端契约一致（见 ADR 04）

---

## 客户端支持规划

### 当前阶段：Web 端（`apps/web`）

专注于 Web 端框架与 API 契约建设。

### 未来客户端

| 客户端 | 代号/路径 | 技术候选 | 类型共享 |
|--------|-----------|----------|----------|
| **移动端** | Orbitchat-rn | React Native（首选）或 Flutter | RN 直接 import `shared-types`；Flutter 走 OpenAPI codegen |
| **桌面端** | 待定 | Electron（预留） | 同 Web |
| **CLI** | 待定 | 预留 | 同 REST API |

**多端原则**（详见 `docs/api-spec.md`）：
- 所有客户端访问同一套 `/api/v1/*` REST API
- 请求携带 `X-Client-Platform` / `X-Client-Version` 标识
- 契约 SSOT：`@orbitchat/shared-types` + 未来 OpenAPI spec

---

## 数据模型概览

### 已实现（见 [db-schema.md](./db-schema.md)）

- Phase 1：`users`、`profiles`、`user_sessions`
- Phase 2：`posts`、`comments`、`likes`、`follows`
- Phase 3A：`conversations`、`conversation_members`、`messages`
- Phase 4A/4B：`agents`、`ai_conversations`、`ai_messages`、`ai_tool_calls`

### 规划中的实体

```
用户 (User)
├── 个人资料 (Profile)
└── 设置 (Settings)

内容 (Post)
├── 评论 (Comment)
├── 点赞 (Like)
└── 标签 (Tag)

社交关系 (Relationship)
├── 关注 (Follow)
└── 黑名单 (Block)

聊天 (Messaging)               # Phase 3A ✅ direct；3B ✅ group + 管理 + typing
├── 对话 (Conversation)      # 1:1 ✅
├── 群组 (ChatGroup)         # 3B
└── 消息 (Message)           # ✅

AI (AiChat)                    # Phase 4A ✅ + 4B send_dm ✅
├── Agent（如「小轨」）        # ✅
├── 会话 (AiConversation)    # ✅
├── 消息 (AiMessage)         # ✅
└── Tool 调用审计 (AiToolCall) # ✅（写 Tool 仅 send_dm）

实时通信 (Realtime)            # Phase 4
├── 通话会话 (CallSession)
└── 信令事件 (SignalingEvent)

橱窗 (Storefront)              # Phase 4–5，可能独立服务
├── 商品 (Product)
└── 订单 (Order)
```

---

## 性能和可靠性目标

### 当前阶段

私聊与 AI 本地验收通过；端到端延迟与可用性指标在 Phase 3B / 部署阶段再正式压测。

### 未来性能指标

- REST API 响应时间 < 200ms（P95）
- 文字消息端到端延迟 < 1s
- 页面加载时间 < 3s
- 系统可用性 > 99.5%

---

## 开发遵循原则

### 1. 文档驱动（Harness Engineering）

Spec 先于代码：`product.md` → `api-spec.md` → `shared-types` → 实现。详见 ADR [05-doc-first.md](./decisions/05-doc-first.md)。

### 2. 类型安全优先

- TypeScript strict mode
- 禁止使用 `any`
- API 契约集中在 `@orbitchat/shared-types`

### 3. 多端 API 一致

- URL 版本前缀 `/api/v1`
- 统一 `SuccessResponse` / `ErrorResponse` envelope
- 基础设施探针 `/health` 例外（无 envelope）

### 4. 渐进式复杂度

- Phase 0 不引入 DB、认证、微服务
- 橱窗等重模块按需拆分，不提前过度设计

---

## 成功标准

### Phase 0–2 ✅

见 [roadmap.md](./roadmap.md)；Phase 2 closeout：[phase-2-closeout.md](./phase-2-closeout.md)。

### Phase 3A ✅（2026-07）

- [x] 1:1 私聊 REST + WS 实时送达
- [x] 消息持久化与历史拉取
- [x] Web `/messages` 收发（含双测试账号验收）
- [x] `last_read_at` 未读数（已修复 Date 查询问题）

### Phase 3B / 3.1

- [x] 群聊 + 群管理（角色、踢人、转让、改群名）
- [x] 私聊 typing（群聊不做 typing）
- [ ] 群邀请链接（3B.1 P1）
- [ ] presence、推送（3.1）
- [ ] 推送通知（3.1）

### Phase 4A ✅（2026-07）

- [x] 本地模型 AI Chat（Ollama + SSE）
- [x] 内置 Agent「小轨」
- [x] 只读 Tool `search_contact`

### Phase 4B（部分）✅ / 待扩展

- [x] `send_dm` + 用户确认 + 审计
- [ ] `create_post`、`follow` 等写 Tool
- [ ] 结构化 Tool schema

### Phase 4C 📋

- [ ] WebRTC、富媒体消息

**合并交付说明**：[phase-3-agent-closeout.md](./phase-3-agent-closeout.md)  
**后续并行计划**：[phase-3-4-next-plan.md](./phase-3-4-next-plan.md)

---

## 质量标准

```
代码可读性 > 可维护性 > 可扩展性 > 功能数量
```

不要过早优化。重点是建立清晰的基础。
