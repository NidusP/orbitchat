# Orbitchat 文档

本目录包含 Orbitchat 项目的所有重要文档。

## 快速导航

### 🚀 新手入门

按顺序阅读这些文档以理解项目：

1. **[../AGENTS.md](../AGENTS.md)** ⭐ **AI Agent 必读**
   - 项目概览和工作指南
   - 适合第一次接触项目时阅读

2. **[product.md](./product.md)** - 产品定义
   - 项目愿景和目标
   - 技术栈选择原因
   - 当前阶段范围

3. **[architecture.md](./architecture.md)** - 系统架构
   - 整体架构设计
   - 目录结构说明
   - 分层设计原理

4. **[architecture-principles.md](./architecture-principles.md)** - 架构设计原则
   - 单向依赖、边界、单写路径、失败隔离等
   - 与 ADR / API 健壮性的分工

5. **[coding-rules.md](./coding-rules.md)** - 编码规范
   - TypeScript 规范
   - 命名约定
   - 代码审查清单

---

## 📚 完整文档列表

| 文档 | 内容 | 何时阅读 |
|------|------|---------|
| [../AGENTS.md](../AGENTS.md) | AI Agent 工作指南 | 第一步 |
| [product.md](./product.md) | 产品定义和目标 | 理解项目时 |
| [architecture.md](./architecture.md) | 系统设计和架构 | 开发前 |
| [architecture-principles.md](./architecture-principles.md) | 架构原则（依赖、边界、一致性等） | 设计新模块时 |
| [coding-rules.md](./coding-rules.md) | 编码规范和最佳实践 | 编写代码时 |
| [api-spec.md](./api-spec.md) | API 规范和数据契约 | 实现 API 时 |
| [multi-client.md](./multi-client.md) | 多端 Token、API Client、设备 Session | Web/RN 开发时 |
| [env.md](./env.md) | 环境变量 | 本地启动前 |
| [../CONTRIBUTING.md](../CONTRIBUTING.md) | 贡献与 PR 流程 | 提交代码前 |
| [realtime-spec.md](./realtime-spec.md) | WebSocket 规范（Phase 3+ 活文档） | 聊天/信令开发时 |
| [db-schema.md](./db-schema.md) | 数据库设计（分阶段迭代） | 数据库设计时 |
| [sql-learning.md](./sql-learning.md) | SQL / 索引学习与项目实战 | 写查询、调性能时 |
| [roadmap.md](./roadmap.md) | 项目路线图和里程碑 | 了解长期计划时 |
| [phase-indie-product-plan.md](./phase-indie-product-plan.md) | **当前迭代** P1/P2 产品就绪计划 | 排期与验收时 |
| [orbit-guide-agent-implementation.md](./orbit-guide-agent-implementation.md) | 小轨 Agent 实现学习指南 | 开发/调试 AI 助手时 |
| [archive/](./archive/) | 已完成阶段过程文档（按 Phase / Wave 归档） | 查历史交付与计划时 |
| [decisions/](./decisions/) | 架构决策记录（ADR） | 理解技术选型时 |

---

## 🎯 按使用场景查找

### 我想了解项目整体

👉 阅读：[product.md](./product.md) + [architecture.md](./architecture.md) + [architecture-principles.md](./architecture-principles.md)

### 我要设计新模块或做架构评审

👉 阅读：[architecture-principles.md](./architecture-principles.md) + 相关 [decisions/](./decisions/) ADR

### 我要开始编写代码

👉 阅读：[coding-rules.md](./coding-rules.md) + 相关的 API 规范

### 我要实现一个新功能

👉 阅读：[roadmap.md](./roadmap.md) + [architecture-principles.md](./architecture-principles.md) + [coding-rules.md](./coding-rules.md)

### 我要设计新 API 端点

👉 阅读：[api-spec.md](./api-spec.md) + [decisions/18-api-robustness.md](./decisions/18-api-robustness.md) + [coding-rules.md](./coding-rules.md)

### 我要参与数据库设计

👉 阅读：[db-schema.md](./db-schema.md) + [sql-learning.md](./sql-learning.md)

### 我是 AI Agent，第一次来这个项目

👉 **必读**：[../AGENTS.md](../AGENTS.md)

### 我要理解小轨（Orbit Guide）Agent 实现

👉 阅读：[orbit-guide-agent-implementation.md](./orbit-guide-agent-implementation.md) + [archive/agent-capability-plans.md](./archive/agent-capability-plans.md) + [decisions/17-ai-agent-architecture.md](./decisions/17-ai-agent-architecture.md)

### 我要查 Phase 3–4 历史交付

👉 阅读：[archive/phase-3-4-delivery.md](./archive/phase-3-4-delivery.md)（按 3A / 4A / 3B / 4B 分节）

---

## 📋 文档结构

```
docs/
├── README.md              # 本文件 - 文档导航
├── product.md             # 产品定义
├── architecture.md        # 系统架构
├── architecture-principles.md  # 架构设计原则
├── coding-rules.md        # 编码规范
├── api-spec.md            # API 规范
├── multi-client.md        # 多端客户端规范
├── env.md                 # 环境变量
├── realtime-spec.md       # 实时通信（Phase 3+）
├── db-schema.md           # 数据库设计
├── sql-learning.md        # SQL / 索引学习（与项目对照）
├── roadmap.md             # 项目路线图
├── phase-indie-product-plan.md  # 当前产品迭代
├── archive/               # 过程文档归档（见 archive/README.md）
└── decisions/             # 架构决策记录（ADR）
```

---

## 🔄 文档维护

### 更新文档的时机

1. **做出架构决策时** - 在 `decisions/` 中记录
2. **改变设计时** - 更新相关的主文档
3. **实现新功能时** - 更新 `product.md` 中的状态
4. **发现最佳实践时** - 更新 `coding-rules.md`

### 文档审查清单

在提交文档更新时检查：

- [ ] 内容准确完整
- [ ] 示例代码可运行
- [ ] 链接正确有效
- [ ] 格式和风格一致
- [ ] 相关文档都已更新

---

## 🏗️ 文档演进

### Phase 0（当前）✅

基础文档与 Phase 0 ADR 已完成。Phase 1 将补充 testing、env、OpenAPI 等文档。

### Phase 1+

随着项目进展，文档会持续更新：

- 📝 新功能相关的 API 文档
- 📝 数据库表设计文档
- 📝 部署和运维文档
- 📝 测试和 CI/CD 文档

---

## ⚡ 关键原则

### 文档即代码

```
✅ 文档应该版本控制
✅ 文档应该代码审查
✅ 文档应该测试（检查链接、代码示例）
❌ 不在代码中重复文档内容
```

### 代码遵循文档

```
代码实现必须遵循文档中的设计
如需改变设计，先更新文档再改代码
文档是意图，代码是实现
```

### 文档驱动开发

```
1. 编写 / 更新文档
2. 代码实现遵循文档
3. 保持同步更新
```

---

## 📞 获取帮助

### 遇到问题时

1. 查看相关文档
2. 搜索 `docs/` 中的关键字
3. 查看 git 历史和提交信息
4. 查看现有代码示例

### 有建议或发现文档问题？

创建 Issue 或提交 PR 更新文档。

---

## 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| 0.0.1 | 2024-06-09 | 初始文档体系 |
| 0.0.2 | 2026-06-14 | Phase 0 ADR、product/api-spec 完善 |
| 0.0.3 | 2026-06-14 | CONTRIBUTING、env、Cursor rules；ADR 08 精简 |
| 0.0.4 | 2026-06-30 | 新增 sql-learning.md（SQL / 索引学习） |

