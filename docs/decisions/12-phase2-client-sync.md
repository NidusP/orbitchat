# ADR 12：Phase 2 客户端数据同步（非实时）

- **状态**：Accepted
- **日期**：2026-06-23
- **阶段**：Phase 2 启动前

## 背景

roadmap Phase 2 需决定：动态、点赞、评论、关注等变更如何到达客户端 — **轮询**还是 **WebSocket**？

项目整体规划中 WebSocket 已留给 Phase 3 聊天（`WS /ws/v1/chat`，见 [realtime-spec.md](../realtime-spec.md)）。Phase 2 若引入 WS，会与 Phase 3 基础设施重复建设，并增加连接管理与鉴权复杂度。

## 选项

| 选项 | 描述 | 优点 | 缺点 |
|------|------|------|------|
| **1. 纯 REST，手动刷新** | 用户操作后 refetch | 最简单 | 他人新帖需用户主动刷新 |
| **2. REST + 定时轮询** | 前台 Tab 周期性 `GET /feed/home` | 近似实时；无长连接 | 无效请求；延迟 = 轮询间隔 |
| **3. REST + SSE** | 服务端单向推送 Feed 事件 | 比 WS 轻 | 需新通道与事件模型 |
| **4. WebSocket** | 双向推送点赞/评论/新帖 | 真实时 | Phase 3 才需要；Phase 2 过早 |
| **5. 完整通知中心 + 推送** | 站内通知 + FCM/APNs | 产品完整 | 属 Phase 2–3 交叉，工作量大 |

## 决策

Phase 2 采用 **REST 为主 + 可选轻量轮询 + 突变后乐观更新**，**不实现 WebSocket**。

### 同步策略矩阵

| 场景 | 策略 |
|------|------|
| **发帖 / 编辑 / 删帖** | 成功后 **乐观更新**本地列表或 `router.refresh()` / SWR `mutate` |
| **点赞 / 取消赞** | **乐观 UI**（立即切换状态与计数）→ API 失败则回滚 |
| **评论** | 成功后向当前帖评论列表 **prepend** 新评论；`comment_count` +1 |
| **关注 / 取关** | 成功后更新按钮状态；不自动刷新 Feed |
| **他人新帖进入首页** | Web 端在 **Feed 页且 Tab 可见** 时，每 **60s** 轮询 `GET /feed/home?limit=20`（仅拉首页第一页或 `since` 参数 — Phase 2 实现时二选一，默认整页替换并去重） |
| **用户离开 Feed 页** | **停止轮询** |
| **Session / 聊天 / 通话** | 仍按 Phase 3+ WS 规划，Phase 2 不建连接 |

### 不做的（明确边界）

- ❌ Phase 2 不实现 `WS /ws/v1/*`
- ❌ 不实现站内 **通知中心**（`notifications` 表、`GET /notifications`）— 留 Phase 2.1 或 Phase 3 与聊天未读合并设计
- ❌ 不实现 FCM / APNs 推送
- ❌ Feed **不**做服务端主动推送

### Web 端实现指引

- 使用现有 `lib/api` + React state / SWR 或 TanStack Query（若引入需小 ADR 补充；**默认继续手写 fetch + context**，与 Phase 1 一致）
- 轮询用 `setInterval` + `document.visibilityState === 'visible'` 守卫，组件卸载时 `clearInterval`
- 错误与 loading 态复用 Phase 1 模式

### 多端（RN / 未来）

- 同一 REST 契约；移动端可用 **下拉刷新** 替代或补充轮询
- Phase 3 聊天上线后，可评估是否在 WS 通道复用 `feed.new_post` 事件 — **不在 Phase 2 预留**

## 原因

- 与 Phase 3「聊天才上 WS」的路线图一致，避免重复基础设施
- 点赞/发帖以用户主动操作为主，乐观更新即可满足 UX
- 60s 轮询足以演示「他人发新帖」场景，且实现成本可控
- 通知中心涉及已读态、聚合、推送 — 独立子系统，不应阻塞 Phase 2 MVP

## 权衡

- 首页新帖最多延迟 60s — 学习项目可接受；可改为 30s 或仅下拉刷新
- 无 WS 时多 Tab 点赞计数可能短暂不一致 — 以服务端为准，下次 refetch 校正
- 轮询增加读 QPS — 单用户低频，Phase 2 无需 Redis

## 后续

1. Web Feed 页实现轮询与 visibility 守卫
2. Phase 3 启动前在 [realtime-spec.md](../realtime-spec.md) 定义 WS 事件；评估是否扩展 Feed 推送
3. 若 Phase 2.1 做通知，新增 ADR：`notifications` 存储与投递

## 相关

- [ADR 11 — Feed 时间线](./11-feed-timeline-strategy.md)
- [realtime-spec.md](../realtime-spec.md)
- [multi-client.md](../multi-client.md)
