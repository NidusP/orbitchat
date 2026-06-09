# 数据库设计 - Orbitchat

## 概览

本文档规划了 Orbitchat 的数据库设计。

**当前阶段**：不实现具体数据库表。本文档预定义数据模型。

---

## 数据库选择

### 当前决策

- **引擎**：暂未确定（可选 PostgreSQL、MySQL、SQLite）
- **ORM**：暂未选择（可选 Prisma、TypeORM、Drizzle）

### 选择时机

在 Phase 1 中进行，基于以下标准：
- TypeScript 支持完善度
- 开发体验
- 性能特性
- 迁移工具完整度

---

## 核心数据模型

### 1. User（用户）

```typescript
interface User {
  id: string;           // UUID
  username: string;     // 唯一用户名
  email: string;        // 唯一邮箱
  passwordHash: string; // 密码哈希（bcrypt）
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

**索引**：username, email

### 2. Profile（用户资料）

```typescript
interface Profile {
  id: string;
  userId: string;       // FK → User.id
  displayName: string;
  bio: string;
  avatar: string;       // URL
  location: string;
  website: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### 3. Post（动态）

```typescript
interface Post {
  id: string;
  authorId: string;     // FK → User.id
  content: string;
  mediaUrls: string[];  // JSON array
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

**索引**：authorId, createdAt

### 4. Like（点赞）

```typescript
interface Like {
  id: string;
  userId: string;       // FK → User.id
  postId: string;       // FK → Post.id
  createdAt: Date;
}
```

**唯一约束**：(userId, postId)

### 5. Comment（评论）

```typescript
interface Comment {
  id: string;
  postId: string;       // FK → Post.id
  authorId: string;     // FK → User.id
  content: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### 6. Follow（关注）

```typescript
interface Follow {
  id: string;
  followerId: string;   // FK → User.id（粉丝）
  followingId: string;  // FK → User.id（被关注者）
  createdAt: Date;
}
```

**唯一约束**：(followerId, followingId)

### 7. Message（私聊消息）

```typescript
interface Message {
  id: string;
  conversationId: string;   // FK → Conversation.id
  senderId: string;         // FK → User.id
  content: string;
  readAt: Date | null;
  createdAt: Date;
}
```

### 8. Conversation（对话）

```typescript
interface Conversation {
  id: string;
  participant1Id: string;   // FK → User.id
  participant2Id: string;   // FK → User.id
  lastMessageAt: Date;
  createdAt: Date;
}
```

---

## 关系图

```
User (1) ──┬── (M) Profile
           ├── (M) Post
           ├── (M) Like → Post
           ├── (M) Comment → Post
           ├── (M) Follow (as follower)
           ├── (M) Follow (as following)
           ├── (M) Message
           └── (M) Conversation
```

---

## 迁移策略

### Phase 1

- 创建基础表（User, Profile）
- 创建认证系统

### Phase 2

- 添加内容表（Post, Like, Comment）
- 添加社交表（Follow）

### Phase 3

- 添加聊天表（Message, Conversation）
- 性能优化（索引、物化视图）

---

## 查询优化考量

### 常见查询

1. **获取用户信息**
   ```sql
   SELECT u.*, p.* FROM User u
   LEFT JOIN Profile p ON u.id = p.userId
   WHERE u.id = ?
   ```

2. **获取用户的粉丝数**
   ```sql
   SELECT COUNT(*) FROM Follow WHERE followingId = ?
   ```

3. **获取动态列表**
   ```sql
   SELECT * FROM Post
   WHERE authorId IN (SELECT followingId FROM Follow WHERE followerId = ?)
   ORDER BY createdAt DESC
   LIMIT ? OFFSET ?
   ```

### 索引规划

| 表名 | 字段 | 类型 |
|-----|------|------|
| User | username, email | UNIQUE |
| Post | authorId, createdAt | COMPOSITE |
| Like | (userId, postId) | UNIQUE |
| Follow | (followerId, followingId) | UNIQUE |
| Comment | postId, createdAt | COMPOSITE |
| Message | conversationId, createdAt | COMPOSITE |

---

## 备份和恢复

### 当前阶段

无具体计划。

### 未来规划

- 每日全量备份
- 实时 WAL 日志
- 异地备份
- 定期恢复测试

---

## 数据隐私

### 合规要求

- 遵守 GDPR 用户数据规范
- 支持用户数据导出
- 支持用户数据删除

### 当前阶段

预留扩展空间。

---

## 监控指标

### 当前阶段

无具体监控。

### 未来指标

- 慢查询日志
- 连接池监控
- 磁盘使用率
- 备份完整性检查
