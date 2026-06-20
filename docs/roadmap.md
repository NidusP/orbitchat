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

- [ ] 动态存储策略
- [ ] Feed 算法（时间线 vs 推荐）
- [ ] 实时更新方案（轮询 vs WebSocket）

### 交付物

- 内容数据库表
- 动态 API 端点
- 前端动态发布页面
- 前端 Feed 页面
- 用户搜索功能

### 成功标准

- [ ] 用户可以发布和管理动态
- [ ] Feed 能正确展示动态
- [ ] 搜索功能可用
- [ ] 性能满足要求（< 500ms）

---

## Phase 3: Messaging（文字聊天 + 群组）

### 时间估计：4-6 周

**目标**：实时文字聊天；群组；Session 踢下线 WS 通知（可选）

### 功能

- 一对一文字聊天
- **群组聊天**（创建群、成员、群消息）
- 未读 / 已读、聊天历史（REST 分页）
- 推送通知（离线消息）
- 在线状态 / 正在输入（可选）

### 文档

- [realtime-spec.md](./realtime-spec.md) — **Phase 3 启动前定稿 WS 事件与 payload**

### 技术决策（Phase 3 前 ADR）

- [ ] WebSocket 实现（Hono/Bun 原生 vs 库）
- [ ] 多实例广播（Redis Pub/Sub，若需要）
- [ ] 移动推送（FCM / APNs）

### 交付物

- conversations / chat_groups / messages 表（见 db-schema 概要）
- `WS /ws/v1/chat`
- 前端 + RN 聊天 UI

### 成功标准

- [ ] 实时消息传输（< 1s 延迟）
- [ ] 消息持久化
- [ ] 推送通知有效

---

## Phase 4: Realtime AV + AI + 多媒体

### 时间估计：8+ 周

**目标**：音视频通话、AI Chat、富媒体动态

### 功能

- **实时语音 / 视频**（WebRTC，`WS /ws/v1/signaling`）
- **AI Chat**（独立会话，与社交 DM 区分）
- 图片 / 视频上传（动态、头像）
- 高级搜索、内容审核（可选）

### 文档

- 扩展 [realtime-spec.md](./realtime-spec.md) — signaling 事件
- 新增 ADR：媒体存储、AI 提供商（Phase 4 前）

### 技术决策（待定）

- [ ] WebRTC TURN/STUN
- [ ] 对象存储（S3 兼容）
- [ ] AI API（OpenAI / 本地模型）

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
| [realtime-spec.md](./realtime-spec.md) | Phase 3 前定稿；每个 WS 事件实现时补 payload |
| [db-schema.md](./db-schema.md) | 进入 Phase N 前展开该 Phase 表结构 |

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

**Year 1**：完成 Phase 1-2，建立核心社交平台  
**Year 2**：完成 Phase 3-4，添加高级功能和多媒体  
**Year 3+**：持续优化和扩展，探索新的功能方向  

**最终目标**：一个具有百万级用户的、功能完整的、架构优雅的社交平台。
