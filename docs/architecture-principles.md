# 架构设计原则 — Orbitchat

> 本文档说明 **系统如何组织、边界在哪、依赖往哪流**——纯项目架构视角。  
> 不涉及 AI 协作或编码风格细节（后者见 [coding-rules.md](./coding-rules.md)、[AGENTS.md](../AGENTS.md)）。

**与其他文档的分工**


| 文档                                                     | 回答什么                               |
| ------------------------------------------------------ | ---------------------------------- |
| [architecture.md](./architecture.md)                   | 系统长什么样：目录、分层、技术栈                   |
| **本文**                                                 | 设计时应遵守的 **原则**（为什么这样切）             |
| [decisions/](./decisions/)（ADR）                        | 某次具体 **选型** 的背景与结论                 |
| [ADR 18 — API 接口健壮性](./decisions/18-api-robustness.md) | 边界上的 **请求级正确性**（400/403/404、状态、幂等） |
| [api-spec.md](./api-spec.md)                           | HTTP **契约**（路径、字段、错误码）             |


可以简单记：**architecture = 结构图；本文 = 设计规则；ADR = 历史决策；api-spec = 对外合同。**

---

## 1. 单向依赖（Dependency Rule）

**内层定义业务；外层适配技术。依赖只能由外指向内，不能反向。**

```
shared-types / domain  ←  services  ←  routes / WS / jobs
                              ↑
                         lib（无业务状态）
```


| 允许                                   | 禁止                                        |
| ------------------------------------ | ----------------------------------------- |
| `routes` 调用 `message-service`        | `message-service` import Hono 的 `Context` |
| 前后端 import `@orbitchat/shared-types` | `shared-types` import `apps/server`       |
| `service` 使用 Drizzle 访问 DB           | Route 里写 SQL 或直接改表                        |


**目的**：业务规则只写一次；换框架、加移动端、加第二个入口时不重写核心逻辑。

**Orbitchat 落地**：`apps/server/src/services/` 承载规则；`routes/v1/` 只做解析、鉴权、调 service、包 `SuccessResponse`。

---



## 2. 边界清晰（Clear Boundaries）

**每个模块有明确的「负责 / 不负责」。跨模块只走公开契约。**


| 边界                        | 负责              | 不负责        |
| ------------------------- | --------------- | ---------- |
| `apps/server` `/api/v1/*` | 业务 REST、鉴权、写库   | 页面渲染       |
| `apps/web`                | UI、客户端状态、调 API  | 核心业务规则     |
| `/health`                 | 进程探活            | 业务信封       |
| WebSocket (`/ws/v1/chat`) | 推送、房间、typing 通知 | 消息持久化的唯一入口 |
| `packages/shared-types`   | 跨端类型与 API 形状    | 运行时逻辑      |


**目的**：避免「Next.js Route Handler 写业务」「WS handler 偷偷改库」等边界泄漏。

**Orbitchat 落地**：业务 REST **只在 Hono**；Next 通过 `lib/api` 调后端（见 ADR 与 [multi-client.md](./multi-client.md)）。

---



## 3. 契约优先（Contract-first）

**先定对外形状，再写实现。契约是稳定层，实现是可替换层。**

顺序建议：

1. [api-spec.md](./api-spec.md) / [realtime-spec.md](./realtime-spec.md) 描述行为
2. `packages/shared-types` 定义类型
3. Service + Route 实现
4. 测试与 [api-robustness-audit.md](./api-robustness-audit.md) 更新

**目的**：Web、未来 App、内部工具对同一套结构通信；改字段时破坏面可见。

**与健壮性的关系**：契约规定 **成功时长什么样**；[ADR 18](./decisions/18-api-robustness.md) 规定 **失败/重复/非法状态时怎么办**。

---



## 4. 单一写入路径（Single Writer）

**每种核心状态只有一个权威写入点；读路径可以有多条。**


| 状态   | 权威写入                                           | 只读/通知                 |
| ---- | ---------------------------------------------- | --------------------- |
| 聊天消息 | `POST .../messages` → DB                       | WS `message.new` 广播   |
| 消息撤回 | `DELETE .../messages` → 软删 + `message_recalls` | WS `message.recalled` |
| 会话已读 | `PATCH .../read` → `last_read_at`              | WS `message.read`     |
| 点赞   | `POST .../like` → `likes` + 计数                 | Feed 读模型              |


**原则**：WS **不**作为业务表的第二写入源；避免 REST 写一份、WS handler 再写一份。

**目的**：数据不会因多入口漂移；排查时只需追一条写路径。

---



## 5. 显式状态与所有权（Explicit State）

**资源有哪些状态、谁拥有、允许哪些迁移——在 Service 层写死，不在 UI 里散落 if。**

示例（消息）：

```
normal ──edit──► edited（保留 message_edits 历史）
   │
   └──recall──► deleted（messages.deleted_at + message_recalls 系统事件）
```

- **所有权**：仅发送者可 edit/recall；群管理是另一套 role 状态机（见 [ADR 16](./decisions/16-group-chat-model.md)）。
- **系统事件 vs 业务消息**：撤回提示在 `message_recalls`，**不是** `messages` 行——不计入未读与会话预览。

**目的**：状态机可测试、可文档化；Route/UI 只触发动作，不各自解释「删了还能不能改」。

---



## 6. 一致性模型（Consistency Model）

**先声明强一致还是最终一致，再选实现——不要默认「到处强一致」或「到处最终一致」。**


| 场景         | Orbitchat 选型          | 含义                    |
| ---------- | --------------------- | --------------------- |
| 发消息、改资料、点赞 | **强一致**（Postgres 事务）  | 读自己的写立即可见             |
| 在线推送       | **尽力送达**（WS）          | 断线靠 REST 拉历史补         |
| 消息编辑       | **不广播**               | 他人最终一致（刷新/再拉列表）       |
| 消息撤回       | **广播 + 持久 recall 事件** | 在线即时；离线靠 `recalls` 数组 |
| 群名等协作编辑    | **乐观锁**（`version` + `expectedVersion`） | 冲突 → `409`；见 [ADR 19](./decisions/19-concurrency-optimistic-pessimistic.md) |
| 橱窗库存（未来）   | **悲观锁 / 原子扣减**      | 防超卖；与协作 version 分离 |


**目的**：产品预期与实现一致；不为实时性在错误层做双写。

---



## 7. 失败域隔离（Failure Domain Isolation）

**一块故障不应拖垮无关能力。**


| 隔离         | 做法                                                                                              |
| ---------- | ----------------------------------------------------------------------------------------------- |
| 基础设施 vs 业务 | `/health` 无业务信封；`/api/v1` 统一错误处理                                                                |
| AI vs 核心社交 | LLM 超时/502 不影响登录、发消息、Feed                                                                       |
| WS vs REST | 断线仍可 REST 拉消息、发消息                                                                               |
| 运行时边界      | Agent runtime、Feed、Chat 分层；共享 DB 但超时与限流可独立（见 [ADR 17](./decisions/17-ai-agent-architecture.md)） |


**目的**：局部降级；排查时缩小爆炸半径。

---



## 8. 安全分层：认证 / 授权 / 资源归属

三层分开，不混在 Route 或 UI 一处：

1. **Authentication**（middleware）：当前用户是谁（JWT + Session）
2. **Authorization**（service）：角色/关系是否允许操作（owner、sender、member）
3. **Resource scope**（service）：URL/body 里的 ID 是否属于该资源（如 `comment.postId === path postId`）

**目的**：安全模型可审计；避免「已登录就能改任意 id」。

**边界质量**：架构上三层都有之后，再用 [ADR 18](./decisions/18-api-robustness.md) 保证每个写 endpoint 都落实。

---



## 9. 存储与读模型分离（Write vs Read Model）

**写表结构服务完整性；读 API 可以组合、投影成 UI 需要的形状。**


| 写模型               | 读模型                                                          |
| ----------------- | ------------------------------------------------------------ |
| `messages`（不含已删）  | 列表 API：`items` + `recalls` 合并时间轴                             |
| `posts` + `likes` | Feed 扇出读（[ADR 11](./decisions/11-feed-timeline-strategy.md)） |
| `message_edits`   | `GET .../edits` 编辑历史                                         |


**目的**：不必为了 UI 时间轴污染核心 message 表；查询优化不反向绑架写入规则。

---



## 10. 演进式边界（Phased Evolution）

**当前阶段不做的能力，在架构上留扩展点，但不提前实现复杂方案。**


| 现在               | 以后可换              | 现在不做                    |
| ---------------- | ----------------- | ----------------------- |
| 单进程 WS Hub       | Redis Pub/Sub 多实例 | 为 multi-instance 先上 K8s |
| Postgres 计数 + 索引 | 必要时 Redis 缓存      | premature cache layer   |
| 1:1 typing       | 群 typing（产品边界）    | 强行统一实现                  |


**目的**：学习项目可渐进演进；决策记录在 ADR / [roadmap.md](./roadmap.md)，避免口头约定。

---



## 11. 接口健壮性（边界质量）

属于架构在 **HTTP/WS 边界** 上的质量要求，细则见 **[ADR 18](./decisions/18-api-robustness.md)** 与 **[api-robustness-audit.md](./api-robustness-audit.md)**。

摘要（与上文互补，不重复展开）：

- Service 层是权威；UI 不能替代  
- 无意义写操作拒绝（内容未变、已撤回再撤回）  
- 幂等语义文档化；并发用条件 `UPDATE` / `ON CONFLICT`  
- 稳定 `code` 字段，不依赖英文 message

**在架构中的位置**：原则 1–10 决定 **系统怎么长**；原则 11 决定 **边界上不能漏什么**。

---



## 新功能 / 新模块自检清单

设计或 PR 评审时可对照（不必全答「是」，但要有 conscious 选择）：

- [ ] **依赖方向**：业务是否只在 `services/`？是否依赖了框架类型？  
- [ ] **边界**：是否只通过 spec + shared-types 跨 app 通信？  
- [ ] **单一写入**：是否只有一个权威写路径？WS 是否只通知不篡库？  
- [ ] **状态机**：状态迁移是否在 service 定义？DB 是否支撑？  
- [ ] **一致性**：强一致还是最终一致？产品是否接受？  
- [ ] **失败域**：新依赖挂了会不会拖垮登录/发消息？  
- [ ] **安全三层**：auth / authz / scope 是否都考虑到？  
- [ ] **读写分离**：写表是否 normalized？读 API 是否必要投影？  
- [ ] **契约**：spec + types 是否已更新？  
- [ ] **健壮性**（写 API 时）：对照 ADR 18 清单与 audit 表  

---



## 相关 ADR 索引


| 主题            | ADR                                                                                  |
| ------------- | ------------------------------------------------------------------------------------ |
| Monorepo      | [01](./decisions/01-monorepo-strategy.md)                                            |
| 后端 / 前端栈      | [02](./decisions/02-backend-framework.md)、[03](./decisions/03-frontend-framework.md) |
| 文档优先          | [05](./decisions/05-doc-first.md)                                                    |
| 认证            | [08](./decisions/08-auth-strategy.md)                                                |
| Feed 读模型      | [11](./decisions/11-feed-timeline-strategy.md)                                       |
| 消息投递          | [14](./decisions/14-message-delivery.md)                                             |
| 会话模型          | [15](./decisions/15-conversation-model.md)                                           |
| 群聊            | [16](./decisions/16-group-chat-model.md)                                             |
| AI Runtime 边界 | [17](./decisions/17-ai-agent-architecture.md)                                        |
| API 健壮性       | [18](./decisions/18-api-robustness.md)                                               |
| 并发控制（乐观/悲观锁） | [19](./decisions/19-concurrency-optimistic-pessimistic.md)                            |


---



## 版本


| 版本  | 日期         | 说明                                              |
| --- | ---------- | ----------------------------------------------- |
| 1.0 | 2026-07-07 | 首版：单向依赖、边界、契约、单写、状态、一致性、失败隔离、安全分层、读写分离、演进、健壮性索引 |


