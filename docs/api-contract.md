# API Contract

## 认证 API

### POST /api/auth/register
注册新用户

**Request**
```json
{
  "username": "string",
  "email": "string",
  "password": "string"
}
```

**Response** (201)
```json
{
  "user": {
    "id": "uuid",
    "username": "string",
    "email": "string"
  },
  "token": "jwt_token"
}
```

### POST /api/auth/login
用户登录

**Request**
```json
{
  "email": "string",
  "password": "string"
}
```

**Response** (200)
```json
{
  "user": {
    "id": "uuid",
    "username": "string",
    "email": "string",
    "avatar": "url"
  },
  "token": "jwt_token"
}
```

---

## 用户 API

### GET /api/users/me
获取当前用户信息

**Headers**: `Authorization: Bearer <token>`

**Response** (200)
```json
{
  "id": "uuid",
  "username": "string",
  "email": "string",
  "avatar": "url",
  "status": "online|offline",
  "lastSeen": "timestamp"
}
```

### PATCH /api/users/me
更新用户信息

**Request**
```json
{
  "username": "string",
  "avatar": "url"
}
```

---

## 会话 API

### GET /api/conversations
获取当前用户会话列表。

旧兼容接口：`GET /api/groups`

**Response** (200)
```json
[
  {
    "id": "uuid",
    "conversationId": "uuid",
    "type": "direct|group",
    "name": "string",
    "avatar": "url",
    "memberCount": 2,
    "lastMessage": {},
    "unreadCount": 0,
    "pinnedAt": "timestamp|null",
    "mutedUntil": "timestamp|null",
    "archivedAt": "timestamp|null",
    "lastActivityAt": "timestamp"
  }
]
```

### POST /api/conversations/direct
创建或获取单聊会话。

旧兼容接口：`POST /api/groups/direct`

**Request**
```json
{
  "userId": "uuid"
}
```

### PATCH /api/conversations/:conversationId/settings
更新当前用户对会话的本地设置。

旧兼容接口：`PATCH /api/groups/:conversationId/settings`

**Request**
```json
{
  "pinned": true,
  "muted": false,
  "archived": false
}
```

---

## 消息 API

### GET /api/messages/:conversationId
获取会话消息历史

**Query**: `?limit=50&before=<messageId>`

推荐使用稳定 cursor：

`?limit=50&beforeCreatedAt=<iso-timestamp>&beforeId=<messageId>`

`before` 仍保留为旧客户端兼容参数，服务端会先查出该消息的 `createdAt` 后再按 `(createdAt, id)` 分页。

**Response** (200)
```json
{
  "messages": [
    {
      "id": "uuid",
      "conversationId": "uuid",
      "senderId": "uuid",
      "content": "string",
      "type": "text|image|file",
      "createdAt": "timestamp"
    }
  ],
  "hasMore": true
}
```

### POST /api/messages
发送消息

**Request**
```json
{
  "conversationId": "uuid",
  "content": "string",
  "type": "text"
}
```

**Response** (201)
```json
{
  "id": "uuid",
  "conversationId": "uuid",
  "senderId": "uuid",
  "content": "string",
  "createdAt": "timestamp"
}
```

---

## 群组 API

### POST /api/groups
创建群组

**Request**
```json
{
  "name": "string",
  "members": ["userId1", "userId2"]
}
```

### PATCH /api/groups/:conversationId
更新群资料，要求当前用户为 owner 或 admin。

### GET /api/groups/:conversationId/members
获取群成员列表。

### POST /api/groups/:conversationId/members
添加群成员，要求当前用户为 owner 或 admin。

### DELETE /api/groups/:conversationId/members/:userId
移除群成员。成员可自行退出，owner/admin 可移除普通成员；owner 不可被移除。

---

## WebSocket Events

### 连接
```js
const socket = io('/', { auth: { token: '<jwt>' } })
```

### 加入会话房间
```js
socket.emit('joinConversation', { conversationId: 'uuid' })
```

### 输入状态
```js
socket.emit('typing:start', { conversationId: 'uuid' })
socket.emit('typing:stop', { conversationId: 'uuid' })
```

### 服务端事件

| Event | 说明 |
| --- | --- |
| `message` | 新消息 |
| `message:updated` | 消息被编辑 |
| `message:deleted` | 消息被删除 |
| `message:reaction` | 表情反应变化 |
| `message:read` | 已读状态变化 |
| `typing` | 输入状态变化 |
| `presence:update` | 在线状态变化 |

---

**Version**: 1.0
**Status**: Draft
