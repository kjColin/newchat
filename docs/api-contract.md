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
  "lastSeen": "timestamp",
  "searchable": true,
  "allowDirectMessages": true
}
```

### PATCH /api/users/me
更新用户信息

**Request**
```json
{
  "username": "string",
  "avatar": "url",
  "searchable": true,
  "allowDirectMessages": true
}
```

`username` 会去除首尾空格，长度为 2-32 字符且必须唯一；`avatar` 为空字符串时会清空头像。`searchable=false` 时不会出现在用户搜索结果；`allowDirectMessages=false` 时仅允许联系人发起单聊。

**Response** (200)
```json
{
  "id": "uuid",
  "username": "string",
  "email": "string",
  "avatar": "url|null",
  "status": "online|offline",
  "lastSeen": "timestamp",
  "searchable": true,
  "allowDirectMessages": true
}
```

### GET /api/users/search
搜索用户，并返回当前用户与搜索结果的联系人/拉黑关系。设置 `searchable=false` 的用户不会出现在搜索结果中。

**Query**: `?q=<keyword>`

**Response** (200)
```json
[
  {
    "id": "uuid",
    "username": "string",
    "email": "string",
    "avatar": null,
    "status": "online",
    "lastSeen": "timestamp",
    "isContact": true,
    "isBlocked": false
  }
]
```

### GET /api/users/contacts
获取当前用户联系人列表。

### POST /api/users/contacts
添加联系人；不能添加自己或已拉黑用户。

**Request**
```json
{
  "userId": "uuid",
  "alias": "optional alias"
}
```

### DELETE /api/users/contacts/:userId
移除联系人。

### GET /api/users/blocks
获取当前用户拉黑列表。

### POST /api/users/blocks
拉黑用户；拉黑时会移除双方已有联系人关系。

拉黑关系会阻止双方新建单聊，并禁止在已有单聊中继续发送消息。

**Request**
```json
{
  "userId": "uuid"
}
```

### DELETE /api/users/blocks/:userId
取消拉黑用户。

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
    "type": "direct|group|channel",
    "name": "string",
    "avatar": "url",
    "description": "string|null",
    "role": "owner|admin|member|subscriber",
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

如果任一方已拉黑另一方，接口返回 403。

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

频道会话仅允许 `owner` 或 `admin` 发送消息；普通订阅者会返回 403。

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

### GET /api/messages/:conversationId/links
获取当前会话内未删除文本消息中的链接列表，用于会话详情中的链接视图。

**Query**:

`?limit=40&senderId=<user-id>&beforeCreatedAt=<iso-timestamp>&beforeId=<message-id>`

分页使用消息的 `(createdAt, id)` cursor；同一条消息内的多个链接会分别返回。`senderId` 可选，用于单聊资料页按联系人/自己筛选历史链接。

**Response** (200)
```json
{
  "links": [
    {
      "id": "message-id:https://example.com",
      "url": "https://example.com",
      "title": "example.com",
      "hostname": "example.com",
      "messageId": "uuid",
      "conversationId": "uuid",
      "content": "message text",
      "createdAt": "timestamp",
      "sender": {
        "id": "uuid",
        "username": "string",
        "avatar": null
      }
    }
  ],
  "hasMore": false
}
```

### GET /api/messages/:conversationId/pinned
获取当前会话置顶消息列表。

**Response** (200)
```json
[
  {
    "conversationId": "uuid",
    "messageId": "uuid",
    "pinnedById": "uuid",
    "pinnedAt": "timestamp",
    "pinnedBy": {
      "id": "uuid",
      "username": "string",
      "avatar": null
    },
    "message": {
      "id": "uuid",
      "conversationId": "uuid",
      "content": "string",
      "sender": {}
    }
  }
]
```

### POST /api/messages/:messageId/pin
置顶一条可访问且未删除的消息。单聊成员可置顶；群聊和频道要求当前用户为 owner 或 admin。

**Response** (201)
```json
{
  "pinnedMessages": []
}
```

### DELETE /api/messages/:conversationId/pinned/:messageId
取消置顶消息。权限要求同置顶接口。

**Response** (200)
```json
{
  "pinnedMessages": []
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

**Request**
```json
{
  "name": "string",
  "avatar": "url",
  "announcement": "string"
}
```

`announcement` 为空字符串时会清空公告，最长 1000 字符。

**Response** (200)
返回更新后的 group conversation 对象，包含 `announcement` 字段。

### GET /api/groups/:conversationId/members
获取群成员列表。

### POST /api/groups/:conversationId/members
添加群成员，要求当前用户为 owner 或 admin。

### DELETE /api/groups/:conversationId/members/:userId
移除群成员。成员可自行退出，owner/admin 可移除普通成员；owner 不可被移除。

### GET /api/groups/discover
按群名称或公告搜索可发现群，并返回当前用户加入状态。

**Query**: `?q=<keyword>`

**Response** (200)
```json
[
  {
    "id": "uuid",
    "groupId": "uuid",
    "conversationId": "uuid",
    "name": "string",
    "announcement": "string|null",
    "avatar": null,
    "memberCount": 12,
    "isJoined": false,
    "role": null
  }
]
```

### POST /api/groups/:conversationId/join
加入可发现群。已在群内时返回现有 group conversation，不会重复创建成员关系。

**Response** (201)
返回 group conversation 对象，结构与 `GET /api/conversations` 中群会话一致。

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

## 频道 API

### POST /api/channels
创建频道。创建者会成为频道 owner，并自动加入关联会话。

**Request**
```json
{
  "name": "string",
  "description": "optional description",
  "avatar": "optional url"
}
```

**Response** (201)
返回 channel conversation 对象，结构与 `GET /api/conversations` 中频道会话一致。

### GET /api/channels/discover
按名称或描述搜索可发现频道，并返回当前用户订阅状态。

**Query**: `?q=<keyword>`

**Response** (200)
```json
[
  {
    "id": "uuid",
    "channelId": "uuid",
    "conversationId": "uuid",
    "name": "string",
    "description": "string|null",
    "avatar": null,
    "memberCount": 12,
    "isSubscribed": false,
    "role": null
  }
]
```

### PATCH /api/channels/:conversationId
更新频道资料，要求当前用户为 owner 或 admin。

**Request**
```json
{
  "name": "string",
  "description": "string",
  "avatar": "url"
}
```

`description` 或 `avatar` 为空字符串时会清空对应字段。

**Response** (200)
返回更新后的 channel conversation 对象。

### POST /api/channels/:conversationId/subscribe
订阅频道。已订阅时返回现有 channel conversation，不会重复创建成员关系。

**Response** (201)
返回 channel conversation 对象，结构与 `GET /api/conversations` 中频道会话一致。

### DELETE /api/channels/:conversationId/subscribe
退订频道。owner 不能通过该接口离开自己拥有的频道。

**Response** (200)
```json
{
  "conversationId": "uuid",
  "channelId": "uuid"
}
```

### GET /api/channels/:conversationId/members
获取频道订阅者列表，要求当前用户已在频道关联会话中。

**Response** (200)
```json
[
  {
    "id": "uuid",
    "channelId": "uuid",
    "userId": "uuid",
    "role": "owner|admin|subscriber",
    "joinedAt": "timestamp",
    "user": {
      "id": "uuid",
      "username": "string",
      "email": "string",
      "avatar": null,
      "status": "online",
      "lastSeen": "timestamp"
    }
  }
]
```

当前版本已支持频道创建、频道会话展示、频道详情、管理员发帖、频道发现、订阅和退订。更细的公开/私有频道策略仍属于后续隐私设置能力。

---

## 通知 API

通知由服务端在消息创建后写入，排除发送者本人，并遵守会话免打扰设置。前端启动时通过 REST 恢复通知列表，在线时通过 `notification` Socket 事件增量更新。

服务端会按 `NOTIFICATION_RETENTION_DAYS` 删除过期通知，并按 `NOTIFICATION_MAX_PER_USER` 保留每个用户最近的通知；后台清理周期由 `NOTIFICATION_CLEANUP_INTERVAL_MINUTES` 控制。默认值分别为 30 天、100 条和 60 分钟。

### GET /api/notifications
获取当前用户最近通知。

**Response** (200)
```json
[
  {
    "id": "uuid",
    "userId": "uuid",
    "conversationId": "uuid",
    "messageId": "uuid|null",
    "title": "string",
    "body": "string",
    "createdAt": "timestamp",
    "read": false
  }
]
```

### PATCH /api/notifications/:notificationId/read
标记单条通知已读。

**Response** (200)
```json
{
  "updated": 1
}
```

### POST /api/notifications/conversations/:conversationId/read
标记当前用户在指定会话下的所有通知已读。

**Response** (200)
```json
{
  "updated": 3
}
```

### POST /api/notifications/read-all
标记当前用户全部通知已读。

**Response** (200)
```json
{
  "updated": 10
}
```

### DELETE /api/notifications
清空当前用户通知列表。

**Response** (200)
```json
{
  "deleted": 10
}
```

---

## WebSocket Events

### 连接
```js
const socket = io('/', { auth: { token: '<jwt>' } })
```

HTTP API 和 Socket API 共用 `CORS_ORIGINS` 作为来源白名单；生产环境未配置时后端会拒绝启动。

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
| `notification` | 当前用户的新站内通知 |
| `typing` | 输入状态变化 |
| `presence:update` | 在线状态变化 |

前端基于 `notification` 事件维护站内通知列表，并基于 `message` 事件触发浏览器通知：仅当消息来自其他用户且不属于当前打开会话时提醒；点击通知会切换到对应会话并标记该通知已读。

---

**Version**: 1.0
**Status**: Draft
