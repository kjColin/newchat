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
      "clientId": "optional-client-id",
      "conversationId": "uuid",
      "senderId": "uuid",
      "replyToId": "uuid|null",
      "forwardFromId": "uuid|null",
      "content": "string",
      "type": "text|image|file",
      "createdAt": "timestamp",
      "attachments": [
        {
          "id": "uuid",
          "kind": "image|video|audio|file",
          "fileName": "name.png",
          "mimeType": "image/png",
          "size": 12345,
          "url": "/uploads/2026-06-13/file.png"
        }
      ],
      "replyTo": {
        "id": "uuid",
        "content": "string",
        "sender": {}
      },
      "forwardFrom": {
        "id": "uuid",
        "content": "string",
        "sender": {}
      }
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
  "type": "text",
  "clientId": "optional-client-id",
  "replyToId": "uuid|null",
  "forwardFromId": "uuid|null",
  "attachmentIds": ["attachment-id"]
}
```

**Response** (201)
```json
{
  "id": "uuid",
  "clientId": "optional-client-id",
  "conversationId": "uuid",
  "senderId": "uuid",
  "content": "string",
  "attachments": [],
  "createdAt": "timestamp"
}
```

### GET /api/messages/:conversationId/search
搜索当前会话内未删除的文本消息。

**Query**: `?q=<keyword>&limit=20`

**Response** (200)
```json
{
  "messages": []
}
```

### GET /api/messages/:conversationId/attachments
获取当前会话内未删除消息关联的附件列表，用于会话详情中的媒体/文件视图。

**Query**:

`?kind=image|video|audio|file&limit=40&beforeCreatedAt=<iso-timestamp>&beforeId=<attachment-id>`

`kind` 可选；不传时返回全部附件。分页使用附件的 `(createdAt, id)` cursor。

**Response** (200)
```json
{
  "attachments": [
    {
      "id": "uuid",
      "messageId": "uuid",
      "uploaderId": "uuid",
      "kind": "image|video|audio|file",
      "fileName": "name.png",
      "mimeType": "image/png",
      "size": 12345,
      "url": "/uploads/2026-06-13/file.png",
      "createdAt": "timestamp",
      "uploader": {
        "id": "uuid",
        "username": "string",
        "avatar": null
      },
      "message": {
        "id": "uuid",
        "conversationId": "uuid",
        "createdAt": "timestamp",
        "sender": {
          "id": "uuid",
          "username": "string",
          "avatar": null
        }
      }
    }
  ],
  "hasMore": false
}
```

### POST /api/messages/:messageId/forward
将一条可访问、未删除的消息转发到目标会话。

**Request**
```json
{
  "conversationId": "target-conversation-id",
  "clientId": "optional-client-id"
}
```

---

## 文件 API

### POST /api/files
上传一个附件，使用 `multipart/form-data`，字段名为 `file`。

当前实现将文件保存到后端本地 `uploads/` 目录，并通过 `/uploads/...` URL 访问。生产环境建议迁移到对象存储。

**Response** (201)
```json
{
  "id": "uuid",
  "uploaderId": "uuid",
  "kind": "image|video|audio|file",
  "fileName": "name.png",
  "mimeType": "image/png",
  "size": 12345,
  "url": "/uploads/2026-06-13/file.png",
  "createdAt": "timestamp"
}
```

上传后发送消息时将附件 id 放入 `attachmentIds`。

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

### GET /api/groups/:conversationId/invites
获取当前群的邀请链接列表，要求当前用户为 owner 或 admin。

**Response** (200)
```json
[
  {
    "id": "uuid",
    "groupId": "uuid",
    "code": "invite-code",
    "createdById": "uuid",
    "expiresAt": null,
    "maxUses": null,
    "usedCount": 0,
    "revokedAt": null,
    "createdAt": "timestamp",
    "createdBy": {
      "id": "uuid",
      "username": "string"
    }
  }
]
```

### POST /api/groups/:conversationId/invites
创建群邀请链接，要求当前用户为 owner 或 admin。

**Response** (201)
```json
{
  "id": "uuid",
  "groupId": "uuid",
  "code": "invite-code",
  "createdById": "uuid",
  "expiresAt": null,
  "maxUses": null,
  "usedCount": 0,
  "revokedAt": null,
  "createdAt": "timestamp"
}
```

前端复制的邀请 URL 形态为：`/chat?invite=<code>`。

### DELETE /api/groups/:conversationId/invites/:inviteId
撤销群邀请链接，要求当前用户为 owner 或 admin。

### GET /api/groups/invites/:code
预览邀请链接对应的群信息。当前接口仍要求登录。

**Response** (200)
```json
{
  "code": "invite-code",
  "group": {
    "id": "uuid",
    "conversationId": "uuid",
    "name": "string",
    "avatar": null,
    "memberCount": 12
  }
}
```

### POST /api/groups/invites/:code/join
通过邀请链接加入群。已在群内的用户不会重复消耗邀请使用次数。

**Response** (201)
返回加入后的 group conversation 对象，结构与 `GET /api/conversations` 中群会话一致。

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
