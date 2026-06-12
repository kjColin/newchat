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

## 消息 API

### GET /api/messages/:conversationId
获取会话消息历史

**Query**: `?limit=50&before=<messageId>`

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

### GET /api/groups
获取用户群组列表

**Response** (200)
```json
{
  "groups": [
    {
      "id": "uuid",
      "name": "string",
      "avatar": "url",
      "memberCount": 5,
      "lastMessage": {}
    }
  ]
}
```

---

## WebSocket Events

### 连接
```js
const ws = new WebSocket('ws://api.example.com/ws?token=<jwt>')
```

### 发送消息
```js
ws.send(JSON.stringify({
  type: 'message',
  data: {
    conversationId: 'uuid',
    content: 'Hello'
  }
}))
```

### 接收消息
```js
ws.onmessage = (event) => {
  const { type, data } = JSON.parse(event.data)
  // type: 'message' | 'typing' | 'online' | 'offline'
}
```

---

**Version**: 1.0
**Status**: Draft
