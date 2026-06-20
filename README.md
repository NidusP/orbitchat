# Orbitchat 🚀

一个用于学习现代全栈 TypeScript 开发和 AI 协作开发（Agentic Engineering）的长期演进学习项目。

> ⭐ **AI Agent 必读**：请先阅读 [AGENTS.md](./AGENTS.md)

---

## 🎯 项目概览

**Orbitchat** 是一个学习型社交平台项目，旨在通过构建完整的、生产级别的应用，学习：

- ✅ 现代 TypeScript 开发
- ✅ 全栈系统设计
- ✅ AI 协作开发流程（Agentic Engineering）
- ✅ Clean Architecture 最佳实践
- ✅ 文档驱动开发

**特征**：
- 🏗️ 完整的 Monorepo 结构
- 📚 文档驱动的开发方式
- 🤖 AI Agent 友好的代码组织
- 🔒 TypeScript strict mode + 完整类型系统
- 📝 清晰的架构和编码规范

---

## 🚀 快速开始

### 前置要求

- Node.js 18+
- pnpm (或 npm / yarn)
- Bun（后端开发）

### 安装依赖

```bash
pnpm install
```

### 本地基础设施（Docker）

```bash
cp .env.example .env    # 可选
pnpm docker:up          # Postgres + Redis
cd apps/server && pnpm db:migrate
```

详见 [docs/env.md](./docs/env.md#docker-compose本地开发)。

### 启动开发服务器

```bash
# 后端 (Bun + Hono)
cd apps/server
pnpm dev

# 前端 (Next.js) - 新窗口/终端
cd apps/web
pnpm dev
```

### 项目链接

- 后端 API：http://localhost:3001
- 前端应用：http://localhost:3000
- API 健康检查：http://localhost:3001/health

---

## 📚 文档

### 🎓 新手入门指南

按顺序阅读（每个约 5-10 分钟）：

1. **[AGENTS.md](./AGENTS.md)** ⭐
   - AI Agent 的工作指南
   - 项目快速导航
   - 当前阶段指南

2. **[docs/product.md](./docs/product.md)**
   - 产品愿景和目标
   - 技术栈选择原因
   - 当前阶段范围

3. **[docs/architecture.md](./docs/architecture.md)**
   - 系统整体设计
   - 目录结构说明
   - 分层设计原理

4. **[docs/coding-rules.md](./docs/coding-rules.md)**
   - TypeScript 编码规范
   - 命名约定
   - 代码审查清单

### 📖 完整文档列表

| 文档 | 内容 |
|------|------|
| [docs/README.md](./docs/README.md) | 文档导航和索引 |
| [docs/product.md](./docs/product.md) | 产品定义 |
| [docs/architecture.md](./docs/architecture.md) | 系统架构设计 |
| [docs/coding-rules.md](./docs/coding-rules.md) | 编码规范 |
| [docs/api-spec.md](./docs/api-spec.md) | API 规范 |
| [docs/multi-client.md](./docs/multi-client.md) | 多端客户端规范 |
| [docs/db-schema.md](./docs/db-schema.md) | 数据库设计 |
| [docs/env.md](./docs/env.md) | 环境变量 |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | 贡献指南 |
| [docs/roadmap.md](./docs/roadmap.md) | 项目路线图 |

---

## 📁 项目结构

```
orbitchat/
├── apps/
│   ├── server/              # 后端 (Bun + Hono)
│   │   ├── src/
│   │   ├── package.json
│   │   └── README.md
│   └── web/                 # 前端 (Next.js)
│       ├── src/
│       ├── package.json
│       └── README.md
├── packages/
│   ├── shared-types/        # 共享类型定义
│   ├── shared-utils/        # 共享工具函数
│   └── ui/                  # UI 组件库（预留）
├── docs/                    # 📚 完整文档
├── .cursor/rules/           # Cursor Agent 规则
├── CONTRIBUTING.md          # 贡献指南
├── AGENTS.md                # 🤖 AI Agent 工作指南
├── pnpm-workspace.yaml      # Monorepo 配置
├── tsconfig.json            # TypeScript 根配置
└── [其他配置文件]
```

### 为什么这样组织？

- **Monorepo**：前后端共享类型和工具，维护简单
- **Separate apps & packages**：清晰的代码边界
- **文档优先**：所有设计在代码前落实在文档

---

## 🛠️ 技术栈

### 后端

- **运行时**：Bun（现代 JS/TS 运行时，性能高）
- **框架**：Hono（轻量级 Web 框架，仅 15KB）
- **语言**：TypeScript（strict mode）

### 前端

- **框架**：Next.js 14+（App Router）
- **UI**：React 18
- **语言**：TypeScript（strict mode）

### Monorepo 管理

- **工具**：pnpm workspace
- **原因**：快速、可靠、支持严格依赖隔离

### 开发工具

- **代码质量**：ESLint + TypeScript strict
- **代码格式**：Prettier
- **编辑器**：EditorConfig

---

## 🎓 当前阶段

**Phase 0 已完成**（2026-06-14）。下一步进入 Phase 1 用户系统。ADR 见 [docs/decisions/](./docs/decisions/)。

### ✅ 已完成

- 项目文档体系
- Monorepo 结构初始化
- 后端框架（Bun + Hono）
- 前端框架（Next.js）
- 共享包结构
- 开发工具链配置

### 🔄 后续阶段

| 阶段 | 目标 | 时间 |
|------|------|------|
| Phase 0 | 基础工程搭建 | ✅ 已完成（2026-06-14） |
| Phase 1 | 用户系统 | ~4-6 周 |
| Phase 2 | 社交功能 | ~6-8 周 |
| Phase 3 | 聊天功能 | ~4-6 周 |
| Phase 4+ | 高级功能 | 持续 |

详见 [docs/roadmap.md](./docs/roadmap.md)

---

## 💻 开发命令

### 所有命令

```bash
# 安装依赖
pnpm install

# 启动开发服务
pnpm dev                    # 后端 + 前端 并行

# 构建
pnpm build                  # 构建所有项目

# 代码检查和格式化
pnpm lint                   # ESLint 检查
pnpm format                 # Prettier 格式化
pnpm format:check          # 检查代码格式

# 类型检查
pnpm type-check            # TypeScript 类型检查（所有项目）
```

### 单个项目命令

```bash
# 后端
cd apps/server
pnpm dev        # 启动开发服务
pnpm build      # 构建

# 前端
cd apps/web
pnpm dev        # 启动开发服务
pnpm build      # 构建
pnpm start      # 启动生产服务

# 共享包
cd packages/shared-types
pnpm type-check # 检查类型
```

---

## 🤖 给 AI Agent 的特别说明

如果你是 Cursor、Claude、Copilot 等 AI Agent，**请先阅读** [AGENTS.md](./AGENTS.md)。

该文件包含：
- 项目概览和工作流程
- 当前阶段的范围和限制
- 编码规范和最佳实践
- AI Agent 特别提醒

---

## 📋 开发工作流

### 新功能开发流程

1. **阅读文档** - 理解需求和设计
2. **查看示例** - 学习现有代码模式
3. **编写类型** - 在 `shared-types` 中定义
4. **实现功能** - 遵循规范编写代码
5. **编写测试** - 验证实现
6. **更新文档** - 保持文档同步

### 代码审查关键点

- [ ] 是否遵循 TypeScript strict mode？
- [ ] 是否避免了 `any` 类型？
- [ ] 函数签名是否完整？
- [ ] 命名是否清晰有意义？
- [ ] 是否遵循 Clean Architecture？
- [ ] 错误处理是否完善？
- [ ] 文档是否同步更新？

---

## 🎨 代码示例

### TypeScript Strict Mode

```typescript
// ✅ 正确 - 完整的类型
const getUserById = (userId: string): Promise<User | null> => {
  return db.query(`SELECT * FROM users WHERE id = ?`, [userId]);
};

// ❌ 错误 - 使用了 any
const getUserById = (userId: any): any => {
  return db.query(`SELECT * FROM users WHERE id = ?`, [userId]);
};
```

### 使用共享类型

```typescript
// 后端
import type { User } from '@orbitchat/shared-types';
import { isValidEmail } from '@orbitchat/shared-utils';

// 前端
import type { User } from '@orbitchat/shared-types';
import { isValidEmail } from '@orbitchat/shared-utils';
```

---

## 🔗 常用链接

### 文档

- [AGENTS.md](./AGENTS.md) - AI Agent 工作指南
- [docs/](./docs/) - 所有文档
- [docs/product.md](./docs/product.md) - 产品定义
- [docs/architecture.md](./docs/architecture.md) - 架构设计
- [docs/coding-rules.md](./docs/coding-rules.md) - 编码规范
- [docs/roadmap.md](./docs/roadmap.md) - 项目路线图

### 项目

- [apps/server/](./apps/server/) - 后端项目
- [apps/web/](./apps/web/) - 前端项目
- [packages/shared-types/](./packages/shared-types/) - 共享类型
- [packages/shared-utils/](./packages/shared-utils/) - 共享工具

---

## ❓ FAQ

### Q: 我是第一次接触这个项目，应该从哪开始？

**A**: 按顺序阅读：
1. [AGENTS.md](./AGENTS.md)
2. [docs/product.md](./docs/product.md)
3. [docs/architecture.md](./docs/architecture.md)
4. 查看项目代码结构

### Q: 当前阶段我应该做什么？

**A**: Phase 0 的目标是完成基础工程。**不要**实现业务逻辑，专注于：
- 理解项目结构
- 学习编码规范
- 配置开发环境

### Q: 为什么有这么多文档？

**A**: 因为这是一个学习项目，文档帮助：
- AI Agent 快速理解意图
- 新人快速上手
- 架构决策可追溯
- 代码实现有章可循

### Q: 当代码和文档不一致时怎么办？

**A**: 优先相信文档。文档是意图，代码是实现。更新代码使其遵循文档。如需改变设计，先更新文档。

### Q: 项目何时实现具体功能？

**A**: 见 [docs/roadmap.md](./docs/roadmap.md)。Phase 0 已完成；Phase 1 开始实现用户认证系统。

---

## 📞 获取帮助

### 遇到问题时

1. **查阅文档** - 答案可能在 docs/ 中
2. **查看代码** - 查看现有实现
3. **查看历史** - 查看 git 日志

### 提问和建议

- 提交 Issue 描述问题
- 提交 PR 贡献改进
- 更新文档完善细节

---

## 📄 许可证

MIT

---

## 🙏 贡献

欢迎提交 Issue、PR 或建议！

请确保：
- ✅ 遵循编码规范（见 `docs/coding-rules.md`）
- ✅ 更新相关文档
- ✅ 提供清晰的提交信息

---

## 🎯 最后的话

> 这个项目的目标不是快速完成功能，而是建立一个清晰、可维护、易于理解的系统。

**核心原则**：
```
代码可读性 > 可维护性 > 可扩展性 > 功能数量
```

欢迎加入 Orbitchat 的开发之旅！🚀

