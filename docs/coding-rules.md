# 编码规范 - Orbitchat

## 概览

本文档定义了 Orbitchat 项目的编码规范，确保代码质量、一致性和易维护性。

---

## TypeScript 规范

### 1. 严格模式

所有项目必须启用 TypeScript strict mode：

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### 2. 禁止使用 any

❌ **不要**：
```typescript
const getData = (response: any): any => {
  return response.data;
};
```

✅ **正确**：
```typescript
interface ApiResponse {
  data: unknown;
  status: number;
}

const getData = (response: ApiResponse): unknown => {
  return response.data;
};
```

### 3. 明确的返回类型

❌ **不要**：
```typescript
const formatDate = (date) => {
  return date.toISOString();
};
```

✅ **正确**：
```typescript
const formatDate = (date: Date): string => {
  return date.toISOString();
};
```

### 4. 类型优先

所有跨模块的数据应先定义类型：

```typescript
// packages/shared-types/src/domain/user.ts
export interface User {
  id: string;
  username: string;
  email: string;
  createdAt: Date;
}

// 然后在任何地方导入
import type { User } from '@orbitchat/shared-types';
```

### 5. 接口 vs 类型别名

**规则**：
- 使用 `interface` 定义对象契约
- 使用 `type` 定义联合、元组、基础类型

```typescript
// 对象契约 → interface
interface User {
  id: string;
  name: string;
}

// 联合类型 → type
type Status = 'pending' | 'completed' | 'failed';

// 函数签名 → type
type Validator = (value: string) => boolean;
```

---

## 命名规范

### 1. 文件命名

- **组件文件** - PascalCase：`UserCard.tsx`
- **工具/函数文件** - camelCase：`formatDate.ts`
- **类型文件** - 根据内容：`user.ts` （域对象），`api.ts` （API 类型）
- **测试文件** - 同名 + `.test.ts`：`formatDate.test.ts`

### 2. 变量/函数命名

- **变量** - camelCase：`const userName = 'John';`
- **常量** - UPPER_SNAKE_CASE：`const MAX_RETRIES = 3;`
- **类** - PascalCase：`class UserService {}`
- **私有成员** - 前缀 `_`：`private _cache: Map<string, any>;`

### 3. 布尔变量

使用 `is`, `has`, `can` 前缀：

```typescript
const isActive: boolean = true;
const hasPermission: boolean = false;
const canEdit: boolean = true;
```

### 4. 避免缩写

❌ **不要**：
```typescript
const usr = 'John';
const getUserById = (uid: string) => {};
```

✅ **正确**：
```typescript
const user = 'John';
const getUserById = (userId: string) => {};
```

---

## 函数设计

### 1. 单一职责

```typescript
// ❌ 做太多
const processUser = (user: User) => {
  validate(user);
  transform(user);
  send(user);
};

// ✅ 分离职责
const validateUser = (user: User): boolean => { /* ... */ };
const transformUser = (user: User): TransformedUser => { /* ... */ };
const sendUser = (user: TransformedUser): Promise<void> => { /* ... */ };
```

### 2. 函数参数

- 最多 3 个参数，否则使用对象参数

```typescript
// ❌ 参数太多
const createUser = (
  username: string,
  email: string,
  password: string,
  firstName: string,
  lastName: string
) => {};

// ✅ 使用对象参数
interface CreateUserInput {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

const createUser = (input: CreateUserInput): User => {};
```

### 3. 返回类型

总是声明返回类型：

```typescript
// ❌
const getUserCount = () => {
  return db.query('SELECT COUNT(*) FROM users');
};

// ✅
const getUserCount = (): Promise<number> => {
  return db.query('SELECT COUNT(*) FROM users');
};
```

---

## 模块组织

### 1. 导入顺序

```typescript
// 1. 外部库
import { Hono } from 'hono';
import type { Context } from 'hono';

// 2. 共享包
import type { User } from '@orbitchat/shared-types';

// 3. 内部模块
import { userService } from '../services/userService';

// 4. 本地导入
import { logger } from '../lib/logger';
```

### 2. 导出

- 优先使用命名导出
- 避免默认导出

```typescript
// ❌ 默认导出
export default function UserService() {}

// ✅ 命名导出
export class UserService {}

// 导入
import { UserService } from './userService';
```

### 3. 索引文件

使用 `index.ts` 暴露公共接口：

```typescript
// services/index.ts
export { UserService } from './UserService';
export { PostService } from './PostService';

// 使用
import { UserService, PostService } from './services';
```

---

## 错误处理

### 1. 使用自定义错误类

```typescript
// lib/errors.ts
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super('VALIDATION_ERROR', message, 400);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super('NOT_FOUND', `${resource} not found`, 404);
  }
}
```

### 2. 错误处理

```typescript
try {
  const user = await getUserById(userId);
  if (!user) {
    throw new NotFoundError('User');
  }
  return user;
} catch (error) {
  if (error instanceof AppError) {
    logger.warn(`${error.code}: ${error.message}`);
    throw error;
  }
  logger.error('Unexpected error:', error);
  throw new AppError('INTERNAL_ERROR', 'Internal Server Error');
}
```

---

## 注释和文档

### 1. JSDoc 注释

仅为非显而易见的功能添加注释：

```typescript
/**
 * 计算用户的推荐分数
 * @param userId - 用户 ID
 * @param actions - 用户行为列表
 * @returns 推荐分数 (0-100)
 */
const calculateRecommendationScore = (
  userId: string,
  actions: UserAction[]
): number => {
  // 实现...
};
```

### 2. 内联注释

用于解释 **为什么**，而不是 **是什么**：

```typescript
// ❌ 显而易见
const users = [];  // 定义一个数组

// ✅ 有价值的解释
// 跳过已存在的用户以避免重复
if (existingIds.has(user.id)) {
  continue;
}
```

---

## Next.js 前端规范

### 1. 组件文件结构

```typescript
// components/UserCard.tsx

// 1. 导入
import { ReactNode } from 'react';
import type { User } from '@orbitchat/shared-types';

// 2. 类型定义
interface UserCardProps {
  user: User;
  onDelete?: () => void;
}

// 3. 组件
export const UserCard: React.FC<UserCardProps> = ({ user, onDelete }) => {
  return (
    <div className="user-card">
      {/* JSX */}
    </div>
  );
};
```

### 2. 钩子命名

```typescript
// hooks/useUser.ts
export const useUser = (userId: string) => {
  const [user, setUser] = React.useState<User | null>(null);
  // 实现...
  return { user, loading, error };
};
```

### 3. API 调用

统一通过 `lib/api.ts`：

```typescript
// lib/api.ts
export const userApi = {
  getById: async (userId: string): Promise<User> => {
    const response = await fetch(`/api/users/${userId}`);
    if (!response.ok) throw new Error('Failed to fetch user');
    return response.json();
  },
};

// components/UserCard.tsx
import { userApi } from '@/lib/api';

const user = await userApi.getById(userId);
```

---

## Hono 后端规范

### 1. 路由定义

```typescript
// routes/users.ts
import { Hono } from 'hono';
import type { User } from '@orbitchat/shared-types';

export const usersRouter = new Hono();

usersRouter.get('/:id', async (c) => {
  const userId = c.req.param('id');
  const user = await userService.getById(userId);
  return c.json(user);
});
```

### 2. 中间件

```typescript
// middleware/auth.ts
import { createMiddleware } from 'hono/factory';

export const authMiddleware = createMiddleware(async (c, next) => {
  const token = c.req.header('Authorization');
  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  // 验证 token
  await next();
});
```

---

## 代码审查检查清单

### 类型安全

- [ ] 无 `any` 类型
- [ ] 所有函数有返回类型
- [ ] 所有参数有类型
- [ ] 共享类型使用 `@orbitchat/shared-types`

### 命名

- [ ] 文件名遵循规范
- [ ] 变量/函数名清晰有意义
- [ ] 布尔变量用 `is/has/can` 前缀

### 结构

- [ ] 单一职责原则
- [ ] 模块职责清晰
- [ ] 导入顺序正确
- [ ] 公共接口通过 `index.ts` 暴露

### 错误处理

- [ ] 使用自定义错误类
- [ ] 错误消息清晰
- [ ] 错误被正确处理和记录

### 注释和文档

- [ ] 注释解释 **为什么** 而不是 **是什么**
- [ ] 复杂函数有 JSDoc
- [ ] 文档与代码同步

---

## Linting 和格式化

### ESLint

使用项目根目录的 `.eslintrc.json` 配置。

```bash
pnpm lint
```

### Prettier

自动格式化所有代码：

```bash
pnpm format
```

### 提交前检查

```bash
pnpm lint       # 检查所有 lint 问题
pnpm format     # 自动格式化
pnpm test       # 单测（含边界 / 异常路径，见 testing.md）
```

**测试原则**：happy path + 边界 + 异常路径 — 详见 [testing.md](./testing.md)。

---

## 参考资源

- [TypeScript 官方文档](https://www.typescriptlang.org/docs/)
- [Airbnb JavaScript 规范](https://github.com/airbnb/javascript)
- [Google TypeScript 规范](https://google.github.io/styleguide/tsguide.html)
