# ADR 05：文档驱动与 Harness Engineering

- **状态**：Accepted
- **日期**：2026-06-14
- **阶段**：Phase 0

## 背景

Orbitchat 是学习型长期项目，核心目标之一是 **Agentic Engineering**（AI 协作开发）。Agent 与人在不同会话、不同工具（Cursor、Copilot 等）中工作，需要稳定、可检索的「项目记忆」，而非依赖对话上下文。

## 选项

1. **代码即文档**
   - 优点：无同步成本
   - 缺点：Agent 无法快速理解意图与边界；架构决策不可追溯

2. **Wiki / Notion 外链**
   - 优点：编辑体验好
   - 缺点：与代码版本脱节，Agent 无法随 repo 读取

3. **Repo 内文档 + AGENTS.md + ADR（Harness Engineering）**
   - 优点：版本化、可审查、Agent 首读 AGENTS.md 即可定位
   - 缺点：需纪律保持同步

## 决策

采用 **Repo 内文档驱动（Document-First）+ Harness Engineering 结构**：

| 层级 | 文件 | 作用 |
|------|------|------|
| Agent 入口 | `AGENTS.md` | 工作流、阶段边界、文档索引 |
| 产品 Spec | `docs/product.md` | 做什么、不做什么 |
| 技术 Spec | `docs/api-spec.md`, `docs/db-schema.md` | 契约与数据模型 |
| 架构 | `docs/architecture.md` | 系统结构与扩展路径 |
| 规范 | `docs/coding-rules.md` | 编码与审查标准 |
| 计划 | `docs/roadmap.md` | 分阶段交付 |
| 决策 | `docs/decisions/*.md` | ADR，记录 why |

## 原因

- **Agent 可预测性**：AGENTS.md 明确 Phase 0 禁止业务逻辑，避免 Agent 过度实现。
- **Spec 先于代码**：api-spec → shared-types → implementation，保证多端类型一致。
- **决策可追溯**：「为什么用 Hono 不用 Nest」写入 ADR，避免重复讨论。
- **与 Harness Engineering 对齐**：文档是 Agent 的 harness（约束与上下文），代码是执行结果。

## 权衡

- 文档滞后于代码时以 **文档为意图** 为准：要么改代码对齐，要么先改文档再改代码（见 AGENTS.md Q5）。
- 文档量需控制：Phase 0 不写未决细节（如具体 ORM），留 ADR 占位。

## 后续

### Agent 工作流（强制）

```
新任务
  → 读 AGENTS.md
  → 读 task 相关 spec（product / api-spec / decisions）
  → 查现有代码
  → 若改契约：先 spec + shared-types
  → 实现
  → 更新文档 / ADR
```

### 文档更新触发条件

| 事件 | 更新 |
|------|------|
| 新 API 端点 | api-spec.md + shared-types |
| 技术选型 | 新 ADR |
| 阶段完成 | roadmap.md + AGENTS.md 阶段节 |
| 产品范围变更 | product.md |

### Phase 0 文档交付（本 ADR 批次）

- [x] 5 篇 Phase 0 ADR
- [x] product.md 补全未来功能模块
- [x] api-spec.md 统一 `/api/v1` 与多端 Header
- [x] AGENTS.md / roadmap.md 状态同步

### 待 Phase 1+ 补充

- [x] `CONTRIBUTING.md`、`docs/env.md`
- [x] `.cursor/rules/orbitchat.mdc`
- [ ] `docs/testing.md`
- [ ] OpenAPI 自动生成与 CI 校验

## 相关

- [AGENTS.md](../../AGENTS.md)
- [docs/README.md](../README.md)
