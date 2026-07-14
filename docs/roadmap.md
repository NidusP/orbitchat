# 项目路线图 - Orbitchat

## 概览

Orbitchat 采用分阶段的迭代方式，从基础工程搭建逐步演进到完整的社交平台。

---

## Phase 0: Foundation（基础工程搭建）

### 时间估计：2-3 周

**目标**：完成所有基础设施和开发规范建设

### 交付物

- ✅ 完整的文档体系
- ✅ Monorepo 初始化
- ✅ 后端框架（Bun + Hono）
- ✅ 前端框架（Next.js）
- ✅ 共享包结构
- ✅ 开发工具链配置
- ✅ Phase 0 ADR（5 篇，见 `docs/decisions/`）
- ✅ API spec 统一 `/api/v1` 与多端 Header 规范

### 里程碑

| 任务 | 优先级 | 完成度 |
|-----|--------|--------|
| 项目文档体系 | P0 | 100% |
| Monorepo 初始化 | P0 | 100% |
| 后端框架 | P0 | 100% |
| 前端框架 | P0 | 100% |
| 共享包 | P1 | 100% |
| 开发规范 | P1 | 100% |

### 成功标准

- [x] 项目结构清晰易维护
- [x] 所有文档完整准确（含 ADR 01–05）
- [x] 后端和前端都能运行
- [x] 开发工具链正常工作
- [x] 代码规范明确可执行

**Phase 0 状态：已完成**（2026-06-14）

---

## Phase 1: User System（用户系统）

### 时间估计：4-6 周

**目标**：实现完整的用户认证和管理系统

### 功能

- 用户注册 / 登录 / 登出
- 多端 Session（Web + RN）；**同平台单 Session**
- 信任设备与会话管理（查看 / 踢下线其他终端）
- 用户资料编辑

### 技术决策

- [x] 数据库：**PostgreSQL**（[ADR 06](./decisions/06-database-choice.md)）
- [x] ORM：**Drizzle**（[ADR 07](./decisions/07-orm-selection.md)）
- [x] 认证：**Session + 双 Token，同端 SSO，信任设备**（[ADR 08](./decisions/08-auth-strategy.md)）
- [x] 密码哈希：**bcrypt**（`Bun.password`，cost 10 — 见 `apps/server/src/lib/crypto.ts`）

### 文档（Phase 1 前置）✅

- [multi-client.md](./multi-client.md)、[db-schema.md](./db-schema.md) Phase 1 章节

### 交付物

- [x] Postgres + Drizzle 迁移（users, profiles, user_sessions）
- [x] `/api/v1/auth/*`、`/api/v1/users/*`
- [x] Web 登录 / 注册 / Profile 页 + API client

### 成功标准

> **本地验证已完成**（2026-06-20）：已复用 `im-postgres` 创建独立 `orbitchat` 数据库并完成 migrate；API 与 Web 主链路手动验证通过。详见 [AGENTS.md](../AGENTS.md)「会话交接」。

- [x] 用户可以完整注册和登录
- [x] Token 正确签发和验证
- [x] 个人资料可以编辑
- [x] 所有 API 都有类型定义（`shared-types` + `pnpm type-check` 通过）

### 可选后续（Phase 1 内，不阻塞 2.15）

完整列表见 [AGENTS.md](../AGENTS.md)「会话交接 → 次要缺口」。

| 优先级 | 项 |
|--------|-----|
| P1 | 扩展 Playwright E2E | ✅ 7 条核心场景 |
| P2 | Web「设备与会话」设置页 | ✅ `/settings/sessions` |
| P2 | Profile 页接入 `PATCH /users/:id` | ✅ |
| P3 | 注册后自动登录 | ✅ 前端 register → login |
| 延后 | Redis 接入、自动化测试套件、ADR 09 评审 |

---

## Phase 2: Social Features（社交功能）

### 状态：**已完成（Closeout B，2026-06-30）**

收尾清单见 [phase-2-closeout.md](./phase-2-closeout.md)。

### 时间估计：6-8 周

**目标**：实现核心社交功能

### 功能

- 发布动态
- 编辑/删除动态
- 点赞
- 评论
- 用户搜索
- 关注/粉丝

### 技术决策

- [x] 动态存储策略 — [ADR 10](./decisions/10-social-content-storage.md)：Postgres 规范化四表，纯文字，软删除，冗余计数
- [x] Feed 算法 — [ADR 11](./decisions/11-feed-timeline-strategy.md)：读扇出 + 时间倒序 + cursor 分页；`GET /feed/home` 与 `GET /users/:id/posts`
- [x] 实时更新 — [ADR 12](./decisions/12-phase2-client-sync.md)：REST + 乐观更新 + Feed 页 60s 轮询；**无 WebSocket**（留 Phase 3）

### 交付物

- 内容数据库表
- 动态 API 端点
- 前端动态发布页面
- 前端 Feed 页面
- 用户搜索功能

### 成功标准

- [x] 用户可以发布和管理动态（含 Web 编辑/删除自己的帖与评论）
- [x] Feed 能正确展示动态
- [x] 搜索功能可用
- [x] 性能满足要求（< 500ms）— 本地 spot check；未做正式压测

**Phase 2 状态：已完成**（2026-06-30）

---

## Phase 3: Messaging（文字聊天 + 群组）

> **3A / 3B 状态：已完成** — 按阶段回顾见 [archive/phase-3-4-delivery.md](./archive/phase-3-4-delivery.md)  
> **当前迭代**：[phase-indie-product-plan.md](./phase-indie-product-plan.md)  
> **历史计划 stub**：[phase-3-kickoff.md](./phase-3-kickoff.md)、[phase-3-plan.md](./phase-3-plan.md)

### 时间估计：4-6 周（整体）；3A 约 3–4 周 ✅

**目标**：实时文字聊天；群组；Session 踢下线 WS 通知（可选）

### 功能（建议按里程碑）

**Phase 3A — 1:1 私聊 MVP** ✅

- [x] 一对一文字聊天
- [x] 聊天历史（REST cursor）
- [x] `WS /ws/v1/chat` 实时送达
- [x] Web 会话列表 + 聊天窗

**Phase 3B — 群聊与增强** ✅

- [x] **群组聊天**（创建群、成员、群消息）
- [x] **群管理**（角色、踢人、转让、改群名、退群）
- [x] **私聊正在输入**（`typing.*`；群聊不做 typing）
- [x] 未读简化 / 已读（`last_read_at`）— 3A 已做
- [ ] 在线状态 presence（可选）
- [ ] 群邀请链接（3B.1 P1）

**延后 Phase 3.1**

- [ ] 推送通知（FCM / APNs）
- [ ] 完整通知中心

### 文档

- [realtime-spec.md](./realtime-spec.md) — 3A 事件已定稿并实现

### 技术决策（Phase 3A）

- [x] WebSocket 实现 → [ADR 13](./decisions/13-websocket-stack.md) Accepted
- [x] 消息投递模型 → [ADR 14](./decisions/14-message-delivery.md) Accepted
- [x] 1:1 会话模型 → [ADR 15](./decisions/15-conversation-model.md) Accepted
- [x] 群聊模型 → [ADR 16](./decisions/16-group-chat-model.md) Accepted
- [ ] 多实例广播（Redis Pub/Sub）— 3B+ / 部署前
- [ ] 移动推送（FCM / APNs）— 延后 Phase 3.1

### 交付物

- [x] Phase 3A：conversations / conversation_members / messages
- [x] Phase 3B：群聊 + 群管理 + 私聊 typing
- [x] `WS /ws/v1/chat`
- [x] Web 聊天 UI；RN 延后

### 成功标准（3A）

- [x] 实时消息传输（本地验收 < 1s）
- [x] 消息持久化
- [x] 刷新后历史完整、顺序正确
- [x] 简化已读（`last_read_at`）可用

> 推送通知（FCM / APNs）延后到 Phase 3.1，不作为 3A/3B 验收门槛。

**Phase 3 整体**：3A ✅；3B ✅；3.1 推送未开始。

---

## Phase 4: Realtime AV + AI + 多媒体

> **4A / 4B 状态：已完成** — 见 [archive/phase-3-4-delivery.md](./archive/phase-3-4-delivery.md)（4A / 4B 节）  
> **4C 状态：待做**；Agent Wave/M 见 [archive/agent-capability-plans.md](./archive/agent-capability-plans.md)

### 时间估计：8+ 周（4A + 4B 切片已交付约 2–3 周当量）

**目标**：音视频通话、AI Chat、富媒体动态

### 里程碑

**Phase 4A — AI Chat MVP** ✅（可与 Phase 3A 并行 — 已并行交付）

- [x] 本地模型服务（Ollama / OpenAI-compatible API）
- [x] AI Chat 独立会话，与社交 DM 区分
- [x] REST + SSE 流式回复
- [x] 内置 Agent「小轨」：闲聊、笑话入口、井字棋提示（轻量）
- [x] 只读 Tool：`search_contact`

**Phase 4B — Agent Tools** ✅

- [x] `send_dm` / `create_post` / `follow_user` / `unfollow_user`（FC + Approve）
- [x] `play_tictactoe`（对局持久化 + rematch + matchHistory）
- [x] Function Calling + `E2eMockLlmProvider`
- [ ] SSE 真流式（[ADR 20](./decisions/20-ai-sse-streaming.md) Phase B/C）、`LLM_API_KEY` 云 API（可选）
- [x] 小轨完善（Wave 0–5）— [archive/agent-capability-plans.md](./archive/agent-capability-plans.md)
- [ ] 对象存储（S3 兼容）— 发帖/头像 ✅；聊天/群头像 P1/P2

**Phase 4C — Realtime AV + 多媒体** 🔄 进行中

- [ ] **实时语音 / 视频**（WebRTC，`WS /ws/v1/signaling`）
- [x] 图片上传（动态、头像）— [ADR 23](./decisions/23-object-storage-uploads.md)，迁移 0019
- [ ] 聊天发图 — P1，见 [phase-indie-product-plan.md](./phase-indie-product-plan.md)
- [ ] 视频上传、高级搜索、内容审核（可选）

### 文档

- [realtime-spec.md](./realtime-spec.md) — 3A WS；signaling 待 4C
- [phase-4a-plan.md](./phase-4a-plan.md) — 4A 计划（已完成）
- [ADR 17](./decisions/17-ai-agent-architecture.md) — Accepted

### 技术决策

- [x] AI API（本地模型，OpenAI-compatible HTTP API）
- [ ] WebRTC TURN/STUN — 4C
- [x] 对象存储（S3 兼容）— MVP 已交付（MinIO 开发）
- [ ] LangGraph / LlamaIndex — 评估轨，见 next-plan

### 并行关系

- Phase 4A 已与 Phase 3A 并行交付。
- Phase 4B 扩展（`create_post` 等）**不依赖 3B**，可与 Track M（群聊）并行。
- Phase 4C 音视频建议独立专轨；**图片上传已 MVP 交付**。

**Phase 4 整体**：4A ✅；4B ✅；4C 多媒体部分 ✅、音视频待做。

---

## Phase 5: 个人橱窗 + 规模优化

### 时间估计：持续

**目标**：橱窗（类商城）；性能与架构演进

### 功能

- **个人橱窗**：商品展示、订单（可能 **Go 独立服务** + Hono 网关）
- 缓存（Redis）、CDN、监控

### 架构

- 见 [architecture.md](./architecture.md) 服务边界概要
- Phase 5 前 ADR：橱窗服务拆分、数据一致性

---

## Phase 6: Scale & Optimize（原 Phase 5 合并演进）

### 方向

- 微服务拆分（按需）、数据库读写分离、消息队列
- 与 Phase 5 并行迭代，不设硬截止时间

---

## 文档与开发进度

| 文档 | 更新节奏 |
|------|----------|
| [roadmap.md](./roadmap.md) | 每 Phase 结束回顾；大功能入列时可提前调整 |
| [archive/phase-3-4-delivery.md](./archive/phase-3-4-delivery.md) | **Phase 3–4 按阶段交付回顾** |
| [phase-indie-product-plan.md](./phase-indie-product-plan.md) | **当前 P1/P2 迭代** |
| [archive/agent-capability-plans.md](./archive/agent-capability-plans.md) | **Agent Wave 0–5 / M1–M3** |
| [realtime-spec.md](./realtime-spec.md) | Phase 3 前定稿；每个 WS 事件实现时补 payload |
| [db-schema.md](./db-schema.md) | 进入 Phase N 前展开该 Phase 表结构 |
| [product.md](./product.md) | 阶段目标与功能表状态 |

---

## 并行工作项

### 所有阶段

- 📝 文档同步更新
- 🧪 单元测试覆盖
- 📊 性能监控
- 🔒 安全审计
- 🎨 UI/UX 优化

---

## 优先级说明

| 优先级 | 含义 | 例子 |
|--------|------|------|
| P0 | 核心阻塞 | 用户认证系统 |
| P1 | 重要功能 | 社交功能 |
| P2 | 增强功能 | 高级搜索 |
| P3 | 优化项目 | 性能监控 |

---

## 风险和缓解

### 风险 1：范围蠕变

**缓解**：严格遵循分阶段计划，新功能统一进入下一阶段

### 风险 2：性能问题

**缓解**：每个阶段都进行性能测试，早期发现问题

### 风险 3：技术债

**缓解**：定期代码审查和重构，保持代码质量

---

## 回顾和调整

每个阶段结束后进行：

1. **功能回顾** - 确认所有交付物完成
2. **质量回顾** - 代码质量、测试覆盖率
3. **性能回顾** - API 响应时间、资源使用
4. **经验教训** - 记录问题和改进
5. **下阶段计划** - 调整优先级和估计

---

## 长期愿景

**Year 1**：Phase 1–2 ✅；Phase 3A + 4A + 4B 切片 ✅（2026-07）  
**Year 1–2**：Phase 3B、4B 扩展、4C — 见 [phase-3-4-next-plan.md](./phase-3-4-next-plan.md)  
**Year 2+**：Phase 5 橱窗、规模优化

**最终目标**：一个具有百万级用户的、功能完整的、架构优雅的社交平台。
