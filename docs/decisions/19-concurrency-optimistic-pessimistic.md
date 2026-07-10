# ADR 19：并发控制 — 乐观锁 vs 悲观锁

## 背景

多人可同时操作同一资源（如群管理员改群名）。若采用「先读后写」且无并发控制，会出现 **lost update**：后写入者覆盖先写入者，且双方都不知道发生冲突。

Orbitchat 需要区分两类场景：

1. **协作编辑** — 多人可改同一元数据；产品上应提示「别人刚改过」，避免静默覆盖。
2. **库存/余额** — 强一致性、不可超卖；需要串行化写入（悲观锁或等价原子扣减）。

## 选项

1. **Last-Write-Wins（无锁）** — 实现简单；协作场景体验差。
2. **乐观锁（version / expectedVersion）** — 读时带 `version`，写时 `WHERE version = expected`；冲突 → `409 CONFLICT`。
3. **悲观锁（`SELECT … FOR UPDATE`）** — 事务内锁行；适合高竞争、必须串行的计数/库存。

## 决策

| 场景 | 策略 |
|------|------|
| 群名等 **协作元数据** | **乐观锁**（`metadata_version` + `expectedVersion`） |
| 状态机迁移、计数兜底 | **原子条件 UPDATE**（见 ADR 18 #7） |
| **橱窗库存**（未来） | **悲观锁** 或 `UPDATE … WHERE stock >= qty` 原子扣减 |

协作编辑统一契约：

- 资源 DTO 暴露 `version`（DB：`metadata_version`，仅协作 PATCH 递增，**不**随发消息等高频写递增）。
- **同一资源的多个协作字段共享一个 `version`**（群名 + 群公告共用 `conversations.metadata_version`）：改任一字段都 +1，任何管理员编辑都能感知彼此的改动。
- 写请求带 `expectedVersion`。
- `UPDATE … SET …, metadata_version = metadata_version + 1 WHERE … AND metadata_version = :expected`。
- 0 行且当前 version 已变 → `409 CONFLICT`，`details` 含 `currentVersion`、`currentTitle` 等。

库存场景（后续 Phase）在 service 事务内 `SELECT … FOR UPDATE`，或专用原子扣减 SQL；**不**复用协作编辑的 version 字段。

## 原因

- 协作编辑冲突应 **可感知、可恢复**（刷新后重试），409 比静默 LWW 符合产品预期。
- 乐观锁无长事务、实现轻，适合 Orbitchat 当前单库、低竞争元数据编辑。
- 库存与协作语义不同，混用同一 version 会误伤（发消息不应 bump 群名 version）。

## 权衡

- 客户端须保存并在 PATCH 时提交 `expectedVersion`。
- 每增加一种协作编辑资源，须约定 version 列与递增点（可复用本 ADR 模式）。

## 后续

1. 群名 + 群公告：`conversations.metadata_version` + `PATCH /conversations/:id` ✅（共享 version）
2. 后续协作字段：优先复用同一 `metadata_version`；语义独立时再引入独立 version 列，写进 api-spec
3. 橱窗库存：新 ADR 补充或在本 ADR 扩展「库存」小节时启用悲观锁

## 相关

- [18-api-robustness.md](./18-api-robustness.md)
- [architecture-principles.md](../architecture-principles.md) §6
- [api-spec.md](../api-spec.md) — `PATCH /conversations/:id`
