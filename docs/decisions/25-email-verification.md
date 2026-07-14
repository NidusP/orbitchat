# ADR 25：邮箱验证（功能开关）

- **状态**：Accepted
- **日期**：2026-07-13
- **阶段**：P2-C

## 背景

独立产品上线前需支持「注册后验证邮箱」，同时开发 / E2E / 单测环境应保持零配置可用（与 `STORAGE_ENABLED` 模式一致）。

## 决策

1. **功能开关**：`EMAIL_VERIFICATION_ENABLED`（默认 `false`）。关闭时注册行为与 Phase 1 一致（`users.email_verified_at = now()`）。
2. **开启时**：注册写入 `email_verified_at = NULL`，生成一次性 token（SHA-256 存库），经 SMTP 发送纯文本验证链接。
3. **验证链接**：`{APP_PUBLIC_URL}/verify-email?token={opaque}`；客户端调用 `POST /api/v1/auth/verify-email`。
4. **重发**：`POST /api/v1/auth/resend-verification`（需登录）；每用户 1 次/分钟（进程内限流，MVP）。
5. **未验证不阻断登录**：MVP 仅 UI 提示（注册成功文案 + Profile 横幅）；后续可收紧敏感操作。

## 数据模型

- `users.email_verified_at TIMESTAMPTZ NULL`
- `email_verification_tokens`：`user_id`、`token_hash`、`expires_at`、`created_at`
- 迁移 `0023` 对存量用户回填 `email_verified_at = created_at`

详见 [db-schema.md](../db-schema.md)。

## 环境变量

| 变量 | 说明 |
|------|------|
| `EMAIL_VERIFICATION_ENABLED` | 默认 `false` |
| `APP_PUBLIC_URL` | 验证链接 Web 根 URL（开启时必填） |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | 开启时必填；nodemailer 传输 |

详见 [env.md](../env.md)。

## API

```
POST /api/v1/auth/verify-email          # body: { token }
POST /api/v1/auth/resend-verification   # 需 Bearer；限流 1/min
```

详见 [api-spec.md](../api-spec.md)。

## 后果

- 开启验证需配置 SMTP；本地可用 Mailpit / Mailhog。
- 单测与 E2E 默认 `EMAIL_VERIFICATION_ENABLED=false`，现有用例无需改动。
- 换邮箱后重置验证状态留 P3（本 ADR 不覆盖）。
