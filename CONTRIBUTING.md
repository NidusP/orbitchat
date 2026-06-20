# 贡献指南 - Orbitchat

感谢参与 Orbitchat。本项目采用 **文档驱动 + Harness Engineering**：先 spec/ADR，再代码。

## 开始之前

1. 阅读 [AGENTS.md](./AGENTS.md)
2. 阅读 [docs/product.md](./docs/product.md) 确认当前 Phase 范围
3. 配置环境：[docs/env.md](./docs/env.md)

## 开发流程

```
Issue / 任务
  → 查 docs/ 与 docs/decisions/（是否已有 ADR）
  → 若改 API：先 docs/api-spec.md + packages/shared-types
  → 若改 DB：先 docs/db-schema.md + Drizzle schema
  → 实现代码
  → pnpm lint && pnpm type-check（根目录，Phase 1 起完善）
  → 更新相关文档
  → PR
```

**原则**：文档是意图，代码是实现。改设计先改文档，再改代码。

## 分支

- `main` — 稳定分支
- 功能分支：`feat/<short-name>`、`fix/<short-name>`、`docs/<short-name>`

## Pull Request

### PR 标题

```
feat(auth): add login endpoint
docs(api): unify session endpoints
fix(web): refresh token on 401
```

### PR 描述建议

- **Summary**：1–3 句说明 why
- **Spec**：链接改动的 `docs/` 或 ADR
- **Test plan**：如何验证（命令或步骤）

### 合并前自检

- [ ] TypeScript strict，无 `any`
- [ ] 业务 API 路径为 `/api/v1/*`
- [ ] 跨端类型在 `@orbitchat/shared-types`
- [ ] 相关 `docs/` 已同步
- [ ] 无 `.env`、密钥、token 提交入库

## 代码规范

详见 [docs/coding-rules.md](./docs/coding-rules.md)。

要点：
- 命名导出优于 default export
- Server 业务逻辑在 `services/`，route 只做 HTTP 适配
- Web 业务 API 调用 Hono，不写在 Next Route Handler（除 BFF 特例）

## 文档

| 变更类型 | 更新 |
|----------|------|
| 新 API | `docs/api-spec.md` + `shared-types` |
| 技术选型 | 新 ADR 于 `docs/decisions/` |
| 环境变量 | `docs/env.md` |
| 客户端行为 | `docs/multi-client.md` |

## 提交信息

完整句子，说明 **why**：

```
feat(server): add session service for per-platform SSO

Implements ADR 08 login flow; revokes prior web session on new login.
```

## 获取帮助

- 架构决策：`docs/decisions/README.md`
- Agent 工作流：`AGENTS.md`
- 多端认证：`docs/multi-client.md`

## 许可证

贡献即表示同意 MIT 许可证（见仓库 LICENSE）。
