# Phase 2 收尾计划（Closeout B）

> **Closeout B（P0）**：✅ 已完成（2026-06-30）  
> **Phase 2 核心**：✅ 可关闭  
> **分支**：`feat/phase-2-social`（commit `d0dd932`）

---

## 一、Closeout B 是什么？

| 层级 | 含义 | 状态 |
|------|------|------|
| **Closeout B（P0）** | roadmap 核心验收 + 管理动态 Web + 测试 + 文档 | ✅ **已完成** |
| **Phase 2.1（P2）** | 增强项，**不阻塞** Phase 2 关闭 | ✅ **核心已完成** |
| **发布线** | push、PR、合 `main` | ⚠️ **未完成** |

**结论**：功能上 **P2 可以认为做完**；工程上还差 **合进 main**，增强项进 **2.1 backlog**。

---

## 二、Closeout B 任务（P0）— 全部完成

| # | 任务 | 状态 |
|---|------|------|
| 1 | Web：编辑 / 删除自己的帖 | ✅ |
| 2 | Web：删除自己的评论 | ✅ |
| 3 | Server：`social.test.ts`（posts/feed） | ✅ |
| 4 | `roadmap.md` 成功标准勾选 | ✅ |
| 5 | `AGENTS.md` 交接 | ✅ |
| 6 | 分支 `feat/phase-2-social` + commit | ✅ |

### 验收清单

- [x] ADR 10–12
- [x] 发布 / 编辑 / 删除动态（Web + API）
- [x] Feed、搜索、关注、评论
- [x] type-check / lint / test / e2e（53 + 7 + 17，含边界用例；见 [testing.md](./testing.md)）
- [x] `sql-learning.md`、`phase-3-kickoff.md`

---

## 三、还没做 — 分三类

### A. 发布线（建议马上做，不算功能缺口）

| 项 | 说明 |
|----|------|
| `git push origin feat/phase-2-social` | 本地已 commit，**未 push** |
| PR → `main` | 若 P1 未合，需决定：先合 P1 或单 PR 含 P1+P2 |
| CI / 浏览器粗测 | PR 前再跑一遍 `pnpm e2e` |

### B. Phase 2.1 增强（原 Closeout 表 P2 延后）

| # | 项 | 说明 | 可与 P3 并行 |
|---|-----|------|--------------|
| 7 | `/users/[id]/followers`、`/following` 页 | API 已有 | ✅ |
| 8 | `pg_trgm` 迁移 + 搜索优化 | 现用 `ILIKE` | ✅ |
| 9 | 性能基准记录 | 正式压测 / `EXPLAIN` 文档化 | 📋 见 sql-learning §4.6 练习 |
| 10 | E2E：编辑/删帖 | 现有 E2E 未覆盖 | ✅ |
| 11 | 帖主删他人评论 | API 支持，Web 未做 | ✅ |
| 12 | `blocks` 黑名单 | ADR 10 延后 | 可选 |

### C. 刻意不做（Phase 3+）

- 通知中心、Feed WS、帖子媒体

---

## 四、推荐你怎么选

```text
现在立刻做  →  A（push + PR）
有空再做    →  B 里挑 1–2 项（建议 7 + 10）
开 Phase 3  →  与 B 并行；见 phase-3-plan.md Wave 0
```

**不必等 2.1 做完再开 P3**；2.1 与 P3 Wave 0 可同时进行。

---

## 五、测试规模（Closeout B 完成时）

| 套件 | 数量 |
|------|------|
| server 单测 | 53 |
| web 单测 | 7 |
| e2e | 17 | Phase 2.1 + 边界场景（空帖/空搜索） |

---

## 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| 0.1.0 | 2026-06-30 | 初版收尾计划 |
| 1.0.0 | 2026-06-30 | Closeout B P0 完成 |
| 1.1.0 | 2026-06-30 | 区分 P0 / 2.1 / 发布线 |
