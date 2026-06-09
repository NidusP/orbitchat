# API 规范 - Orbitchat

## 概览

本文档定义了 Orbitchat API 的设计规范。

**当前阶段**：暂无具体 API 端点实现，本文档预定义规范框架。

---

## API 设计原则

### 1. RESTful 风格

- 使用 HTTP 方法表达语义（GET、POST、PUT、DELETE）
- 资源导向的 URL 设计
- 无状态的请求-响应模式

### 2. 统一响应格式

所有 API 返回统一的 JSON 格式：

```typescript
// 成功响应
interface SuccessResponse<T> {
  code: 'SUCCESS';
  data: T;
  timestamp: string;
}

// 错误响应
interface ErrorResponse {
  code: string;        // 错误代码
  message: string;     // 错误消息
  details?: unknown;   // 额外信息（可选）
  timestamp: string;
}
```

### 3. HTTP 状态码

| 状态码 | 含义 | 场景 |
|--------|------|------|
| 200 | OK | 请求成功 |
| 201 | Created | 资源创建成功 |
| 400 | Bad Request | 请求参数错误 |
| 401 | Unauthorized | 认证失败 |
| 403 | Forbidden | 无权限 |
| 404 | Not Found | 资源不存在 |
| 409 | Conflict | 资源冲突（如重复） |
| 500 | Internal Server Error | 服务器错误 |

### 4. 分页

所有列表 API 都支持分页：

```typescript
interface PaginatedRequest {
  page: number;        // 页码，从 1 开始
  limit: number;       // 每页数量，默认 20，最大 100
}

interface PaginatedResponse<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;       // 总数
  hasNextPage: boolean;
}
```

---

## 数据契约

### 基础数据类型

使用 `shared-types` 统一定义。详见 `packages/shared-types/src/`。

### 时间格式

所有时间戳使用 ISO 8601 格式：

```
2024-06-09T22:19:35.981Z
```

### 标识符

所有 ID 使用 UUID v4：

```typescript
interface Entity {
  id: string;  // UUID v4 format
  createdAt: string;  // ISO 8601
  updatedAt: string;  // ISO 8601
}
```

---

## 错误处理

### 错误代码规范

```
VALIDATION_ERROR       - 参数验证失败
NOT_FOUND             - 资源不存在
UNAUTHORIZED          - 认证失败
FORBIDDEN             - 无权限
CONFLICT              - 资源冲突
INTERNAL_ERROR        - 服务器内部错误
```

### 错误响应示例

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Invalid email format",
  "details": {
    "field": "email",
    "value": "invalid-email"
  },
  "timestamp": "2024-06-09T22:19:35.981Z"
}
```

---

## 认证

### Token 类型

使用 Bearer Token（JWT）：

```
Authorization: Bearer <token>
```

### Token 结构

```typescript
interface JWTPayload {
  sub: string;         // 用户 ID
  email: string;
  iat: number;         // 签发时间
  exp: number;         // 过期时间
}
```

---

## API 端点规划

### 当前阶段

- 健康检查 `/health`（已有框架）
- 其他端点暂未实现

### Phase 1 端点

#### 用户相关

```
POST   /api/users              # 注册
POST   /api/auth/login         # 登录
POST   /api/auth/logout        # 登出
GET    /api/users/:id          # 获取用户信息
PUT    /api/users/:id          # 更新用户信息
GET    /api/users/:id/profile  # 获取用户资料
```

#### 内容相关（预留）

```
GET    /api/posts              # 获取动态列表
POST   /api/posts              # 发布动态
GET    /api/posts/:id          # 获取单条动态
PUT    /api/posts/:id          # 编辑动态
DELETE /api/posts/:id          # 删除动态
```

#### 社交相关（预留）

```
POST   /api/users/:id/follow   # 关注用户
DELETE /api/users/:id/follow   # 取消关注
GET    /api/users/:id/followers # 获取粉丝列表
GET    /api/users/:id/following # 获取关注列表
```

---

## 版本管理

### API 版本策略

- 当前版本：`v1`
- 在 URL 中体现版本：`/api/v1/...`

### 向后兼容性

- 永远不移除已有字段
- 只可添加可选字段
- 重要变更通过新版本实现

---

## 性能约束

### 当前阶段

无具体约束。

### 未来指标

- 响应时间 < 200ms（P95）
- 支持 1000+ 并发
- 列表分页限制 100 项

---

## 安全考量

### 当前阶段

- CORS 配置（允许所有源）
- 无认证要求

### 未来安全

- HTTPS 强制
- 速率限制
- 输入验证
- SQL 注入防护
- XSS 防护

---

## 示例 API 端点

### 健康检查

```
GET /health

Response:
{
  "status": "ok",
  "timestamp": "2024-06-09T22:19:35.981Z"
}
```

### 获取用户信息（规划）

```
GET /api/v1/users/123

Request Headers:
Authorization: Bearer <token>

Response (200):
{
  "code": "SUCCESS",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "username": "john_doe",
    "email": "john@example.com",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-06-09T22:19:35.981Z"
  },
  "timestamp": "2024-06-09T22:19:35.981Z"
}

Response (404):
{
  "code": "NOT_FOUND",
  "message": "User not found",
  "timestamp": "2024-06-09T22:19:35.981Z"
}
```

---

## API 文档维护

- 使用 OpenAPI / Swagger（未来集成）
- 所有 API 端点需要文档
- 定期审查和更新
