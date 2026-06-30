# Phase 2 收尾计划（Closeout B）

> **状态**：✅ 已完成（2026-06-30）  
> **分支**：`feat/phase-2-social`

## 目标

在 MVP 已跑通的前提下，补齐 roadmap **「发布和管理动态」**、测试与文档，达到可 PR 合 `main` 的 Phase 2 关闭标准。

---

## 任务清单

| # | 任务 | 优先级 | 状态 |
|---|------|--------|------|
| 1 | Web：作者可 **编辑 / 删除** 自己的帖 | P0 | ✅ |
| 2 | Web：作者可 **删除** 自己的评论 | P0 | ✅ |
| 3 | Server：`posts` / `feed` 路由集成测试 | P0 | ✅ `social.test.ts` |
| 4 | 勾选 `roadmap.md` Phase 2 成功标准 | P0 | ✅ |
| 5 | 更新 `AGENTS.md` 会话交接 | P0 | ✅ |
| 6 | Git：`feat/phase-2-social` 分支 + commit | P0 | ✅ |
| 7 | 粉丝/关注列表 Web 页 | P2 | 延后 Phase 2.1 |
| 8 | `pg_trgm` 迁移 | P2 | 延后 |
| 9 | 性能基准 < 500ms | P2 | 本地 spot check |

---

## 验收标准（与 roadmap 对齐）

- [x] 技术决策 ADR 10–12
- [x] 用户可发布、编辑、删除自己的动态（Web + API）
- [x] Feed 正确展示（含关注扇出）
- [x] 搜索与关注可用
- [x] 评论可读可发可删（作者）
- [x] `pnpm type-check` / `lint` / `test` / `e2e`
- [x] 文档：`roadmap`、`AGENTS`、`sql-learning`、`phase-3-kickoff`

---

## 测试规模（收尾完成时）

| 套件 | 数量 |
|------|------|
| server 单测 | 42（含 social 5） |
| web 单测 | 7 |
| e2e | 12 |

---

## 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| 0.1.0 | 2026-06-30 | 初版收尾计划 |
| 1.0.0 | 2026-06-30 | Closeout B 完成 |
