# NewChat 架构设计

## 1. 背景

NewChat 是一个面向即时通讯场景的 Web 聊天应用，目标体验参考 Telegram 的核心聊天能力：单聊、群聊、实时消息、在线状态、已读、置顶、免打扰、归档、消息编辑/删除、表情反应、文件消息、搜索与通知。

当前用户提到的 `/root/.openclaw/workspace/newchat` 目录在本机不存在。实际运行目录来自 systemd 服务：

- 后端：`/root/.openclaw/workspace/chat-app/src/backend`
- 前端：`/root/.openclaw/workspace/chat-app/src/frontend`

本文档以当前 `chat-app` 源码为基线，描述目标架构和后续演进方案。

## 2. 架构目标

### 2.1 产品目标

- 支持用户注册、登录、个人资料与头像。
- 支持用户搜索、单聊、群聊、群成员管理、群邀请链接。
- 支持实时消息、输入中、在线状态、已读状态。
- 支持消息编辑、删除、表情反应、回复、转发。
- 支持图片、文件、语音等附件消息。
- 支持会话置顶、免打扰、归档、未读统计。
- 支持消息搜索、会话内搜索、媒体/文件列表。
- 支持后续扩展频道、公开群、机器人接口。

### 2.2 工程目标

- 领域模块清晰，避免会话、群、消息逻辑混在单个 service 中。
- REST 负责查询与命令提交，WebSocket 负责实时事件推送。
- 数据写入以数据库为准，Socket 事件只作为投递通道。
- 支持横向扩展：后续可引入 Redis、对象存储、消息队列。
- 保持前后端类型与 API 契约稳定，降低迭代成本。

## 3. 技术栈

| 层级 | 技术 |
| --- | --- |
| 前端 | React 18 + TypeScript + Vite |
| 路由 | React Router |
| HTTP 客户端 | Axios |
| 实时通信 | Socket.IO Client |
| 后端 | NestJS + TypeScript |
| 实时网关 | `@nestjs/websockets` + Socket.IO |
| ORM | Prisma |
| 数据库 | PostgreSQL |
| 认证 | JWT + Passport |
| 密码哈希 | bcrypt |
| 部署 | systemd / Docker Compose / Nginx |

## 4. 总体架构

```text
┌──────────────────────────────────────────────┐
│                  Browser UI                  │
│         React / Vite / Feature Modules       │
└───────────────────────┬──────────────────────┘
                        │
              REST / WebSocket
                        │
┌───────────────────────▼──────────────────────┐
│                 NestJS Backend               │
│ REST Controllers / WebSocket Gateway / DTOs  │
└───────────────────────┬──────────────────────┘
                        │
              Domain Services
                        │
┌───────────────────────▼──────────────────────┐
│          Application / Domain Layer           │
│ Auth / Users / Conversations / Messages      │
│ Groups / Files / Presence / Notifications    │
└───────────────────────┬──────────────────────┘
                        │
              Prisma Repository Access
                        │
┌───────────────────────▼──────────────────────┐
│                PostgreSQL                    │
│ Users / Conversations / Messages / Members   │
│ Reactions / Read States / Attachments        │
└──────────────────────────────────────────────┘
```

后续生产扩展：

```text
┌──────────┐     ┌────────────┐     ┌──────────────┐
│  Nginx   │────▶│ NestJS API │────▶│ PostgreSQL   │
└──────────┘     └─────┬──────┘     └──────────────┘
                       │
          ┌────────────┼────────────┐
          │            │            │
     ┌────▼────┐  ┌────▼────┐  ┌────▼────────┐
     │ Redis   │  │ Object  │  │ Queue/Jobs  │
     │ WS Pub  │  │ Storage │  │ Notification│
     │ Cache   │  │ Files   │  │ Workers     │
     └─────────┘  └─────────┘  └─────────────┘
```

## 5. 前端架构

### 5.1 目录规划

```text
src/frontend/src
├── pages
│   ├── Login.tsx
│   └── Chat.tsx
├── features
│   ├── auth
│   ├── users
│   ├── chats
│   ├── groups
│   ├── files
│   ├── search
│   └── notifications
├── shared
│   ├── api
│   ├── components
│   ├── hooks
│   └── utils
└── App.tsx
```

当前 `Chat.tsx` 已承载较多状态和事件处理。后续应拆分为：

- `useConversations`：会话列表、置顶、免打扰、归档、未读计数。
- `useMessages`：消息加载、分页、发送、编辑、删除、反应。
- `useChatSocket`：Socket 连接、事件订阅、房间加入、断线重连。
- `useGroupMembers`：群成员列表、添加成员、移除成员、群信息更新。
- `useUserSearch`：用户搜索、去抖、搜索结果状态。

### 5.2 前端数据流

```text
UI Event
  │
  ├─ REST command/query
  │    └─ update local state from response
  │
  └─ Socket event
       └─ reconcile local state by id/clientId
```

原则：

- 发送消息先走 REST，后端落库成功后返回消息。
- Socket 收到同一条消息时使用 `message.id` 或 `clientId` 去重。
- 会话列表中的 `lastMessage`、`unreadCount`、`lastActivityAt` 通过统一 reducer 更新。
- 本地状态不直接信任 Socket 中的权限变更，关键操作以 REST 返回为准。

## 6. 后端架构

### 6.1 模块拆分

| 模块 | 职责 |
| --- | --- |
| `AuthModule` | 注册、登录、JWT 签发、认证守卫 |
| `UsersModule` | 当前用户、资料更新、用户搜索、隐私设置 |
| `ConversationsModule` | 单聊/群聊会话创建、会话列表、置顶、免打扰、归档 |
| `MessagesModule` | 消息发送、历史、分页、编辑、删除、回复、转发、反应、已读 |
| `GroupsModule` | 群信息、成员、角色、权限、邀请链接 |
| `FilesModule` | 文件上传、下载、附件元数据、缩略图 |
| `PresenceModule` | 在线状态、多设备连接、最后在线时间 |
| `NotificationsModule` | 站内通知、Web Push、未读提醒 |
| `SearchModule` | 用户、会话、消息全文搜索 |

当前代码中 `GroupsService` 同时承担单聊会话、群聊会话和群成员管理。建议下一步抽出 `ConversationsService`，把 `createDirect`、`findByUser`、`updateSettings` 移入会话模块，`GroupsService` 只保留群资料和成员权限。

### 6.2 后端分层

```text
Controller / Gateway
  │  参数校验、认证、协议适配
  ▼
Application Service
  │  用例编排、事务、权限判断
  ▼
Domain Helpers
  │  消息格式化、权限策略、未读计算
  ▼
Prisma Service
  │  数据库访问
  ▼
PostgreSQL
```

规则：

- Controller 不写业务逻辑。
- Gateway 不直接改业务数据，复杂逻辑调用 service。
- Service 内部处理权限、事务和一致性。
- Prisma include/select 统一收敛为 helper，避免返回敏感字段。

## 7. 数据模型

### 7.1 当前核心模型

| 模型 | 说明 |
| --- | --- |
| `User` | 用户、邮箱、密码哈希、头像、在线状态 |
| `Conversation` | 会话，区分 `direct` 和 `group` |
| `UserConversation` | 用户与会话关系，保存已读、置顶、免打扰、归档 |
| `Message` | 消息主体，支持文本、编辑、软删除 |
| `MessageReaction` | 消息表情反应 |
| `Group` | 群资料、群主、关联会话 |
| `GroupMember` | 群成员和角色 |
| `Attachment` | 文件/图片等附件元数据 |
| `InviteLink` | 群邀请链接、撤销状态、使用次数 |

### 7.2 建议新增模型

```prisma
model MessageReadReceipt {
  messageId String
  userId    String
  readAt    DateTime @default(now())

  @@id([messageId, userId])
}

model PinnedMessage {
  conversationId String
  messageId      String
  pinnedById     String
  pinnedAt       DateTime @default(now())

  @@id([conversationId, messageId])
}

model Contact {
  ownerId   String
  userId    String
  alias     String?
  createdAt DateTime @default(now())

  @@id([ownerId, userId])
}

model BlockList {
  blockerId String
  blockedId String
  createdAt DateTime @default(now())

  @@id([blockerId, blockedId])
}
```

`Message` 建议扩展字段：

- `clientId`：客户端临时 ID，用于弱网重试和 Socket 去重。
- `replyToId`：回复某条消息。
- `forwardFromId`：转发来源消息。
- `metadata`：JSON 扩展字段，保存客户端展示需要的轻量信息。

## 8. API 边界

### 8.1 REST API

REST API 负责可重放、可校验的命令和查询。

| Method | Endpoint | 说明 |
| --- | --- | --- |
| `POST` | `/api/auth/register` | 注册 |
| `POST` | `/api/auth/login` | 登录 |
| `GET` | `/api/users/me` | 当前用户 |
| `PATCH` | `/api/users/me` | 更新个人资料 |
| `GET` | `/api/users/search?q=` | 搜索用户 |
| `GET` | `/api/conversations` | 会话列表 |
| `POST` | `/api/conversations/direct` | 创建/获取单聊 |
| `PATCH` | `/api/conversations/:id/settings` | 置顶、免打扰、归档 |
| `GET` | `/api/messages/:conversationId` | 消息历史分页 |
| `POST` | `/api/messages` | 发送消息 |
| `PATCH` | `/api/messages/:id` | 编辑消息 |
| `DELETE` | `/api/messages/:id` | 删除消息 |
| `POST` | `/api/messages/:id/reactions` | 切换表情反应 |
| `POST` | `/api/messages/:conversationId/read` | 标记已读 |
| `POST` | `/api/groups` | 创建群 |
| `PATCH` | `/api/groups/:conversationId` | 更新群信息 |
| `GET` | `/api/groups/:conversationId/members` | 群成员列表 |
| `POST` | `/api/groups/:conversationId/members` | 添加群成员 |
| `DELETE` | `/api/groups/:conversationId/members/:userId` | 移除群成员 |
| `GET` | `/api/groups/:conversationId/invites` | 群邀请链接列表 |
| `POST` | `/api/groups/:conversationId/invites` | 创建群邀请链接 |
| `DELETE` | `/api/groups/:conversationId/invites/:inviteId` | 撤销群邀请链接 |
| `GET` | `/api/groups/invites/:code` | 预览邀请链接 |
| `POST` | `/api/groups/invites/:code/join` | 通过邀请链接入群 |
| `POST` | `/api/files` | 上传附件 |

### 8.2 WebSocket Events

Socket 事件负责实时通知，不作为唯一数据源。

| Event | 方向 | 说明 |
| --- | --- | --- |
| `joinConversation` | Client -> Server | 加入会话房间 |
| `typing:start` | Client -> Server | 开始输入 |
| `typing:stop` | Client -> Server | 停止输入 |
| `message` | Server -> Client | 新消息 |
| `message:updated` | Server -> Client | 消息被编辑 |
| `message:deleted` | Server -> Client | 消息被删除 |
| `message:reaction` | Server -> Client | 表情反应变化 |
| `message:read` | Server -> Client | 已读状态变化 |
| `presence:update` | Server -> Client | 用户在线状态变化 |
| `conversation:updated` | Server -> Client | 会话设置或群信息变化 |
| `group:membersUpdated` | Server -> Client | 群成员变化 |

## 9. 核心流程

### 9.1 发送文本消息

```text
Client
  │ POST /api/messages { conversationId, content, clientId }
  ▼
MessagesController
  │ validate DTO + JWT
  ▼
MessagesService
  │ check participant
  │ create message in transaction
  │ update conversation.updatedAt
  │ update sender lastReadAt
  ▼
PostgreSQL
  │
  ▼
MessagesGateway
  │ emit "message" to conversation room
  ▼
Clients
```

### 9.2 加载消息历史

- 使用 cursor 分页，不使用 `id < before`。
- 推荐参数：`?limit=50&beforeCreatedAt=<iso>&beforeId=<uuid>`。
- 排序：`createdAt desc, id desc`，返回前端前再按时间升序展示。

### 9.3 已读状态

- 简化版：`UserConversation.lastReadAt` 表示该用户在会话中的最后阅读时间。
- 增强版：`MessageReadReceipt` 记录消息级已读，可用于小群展示“谁已读”。
- 大群默认只展示未读数，不展示每条消息的完整已读名单。

### 9.4 在线状态

当前实现中一个 Socket 断开会直接把用户设为 offline。多设备场景应改为：

```text
userId -> active socket count
```

- 任意设备连接：用户 online。
- 某个设备断开：只减少连接数。
- 连接数归零：延迟 15-30 秒后标记 offline，防止刷新页面造成闪烁。
- 多实例部署时连接状态放入 Redis。

### 9.5 文件消息

```text
Client selects file
  │
  ├─ POST /api/files
  │    └─ store file + create Attachment draft
  │
  └─ POST /api/messages { type, attachmentIds }
       └─ emit message with attachment metadata
```

当前实现先使用后端本地 `uploads/` 目录保存文件，并通过 `/uploads/...` 静态路径访问；生产建议迁移到 S3 兼容对象存储，并保留数据库中的附件元数据。

## 10. 安全设计

- JWT secret 必须来自环境变量，生产环境禁止默认值。
- 密码使用 bcrypt 哈希，禁止返回 password 字段。
- 所有写接口使用 DTO 和 class-validator。
- 所有会话、消息、群操作必须校验参与者或管理员权限。
- 上传文件限制大小、扩展名、MIME 类型，必要时接入病毒扫描。
- Rate limit 应从内存实现迁移到 Redis，支持多实例。
- CORS 白名单通过环境变量配置。
- `.env`、`dist`、`node_modules`、数据库备份不应进入版本管理。

## 11. 性能与可靠性

### 11.1 数据库索引

建议增加索引：

- `Message(conversationId, createdAt, id)`
- `Message(senderId, createdAt)`
- `UserConversation(userId, archivedAt, pinnedAt)`
- `MessageReaction(messageId)`
- `GroupMember(groupId, role)`
- `User(username)`、`User(email)` 搜索索引

### 11.2 Socket 横向扩展

单实例阶段可直接使用 Socket.IO 默认 adapter。多实例阶段需要：

- Redis adapter 广播跨进程事件。
- Redis 保存在线状态和 socket 计数。
- Nginx 开启 WebSocket 代理。
- 可选 sticky session，降低重连成本。

### 11.3 弱网与幂等

- 客户端发送消息携带 `clientId`。
- 后端对 `(senderId, clientId)` 建唯一约束。
- 客户端收到 REST 返回和 Socket 推送时按 `id/clientId` 去重。
- Socket 重连后重新拉取 active conversation 的最新消息。

## 12. 部署架构

### 12.1 当前部署

- Backend systemd service：监听 `127.0.0.1:3101`
- Frontend Vite preview：监听 `127.0.0.1:4173`
- Nginx 对外反向代理

### 12.2 推荐生产部署

```text
Nginx
  ├─ /api/*        -> backend:3101
  ├─ /socket.io/*  -> backend:3101
  └─ /*            -> frontend static files

Backend
  ├─ NestJS compiled dist
  ├─ Prisma migrations
  └─ environment variables

Data
  ├─ PostgreSQL
  ├─ Redis
  └─ Object Storage
```

前端生产环境建议使用静态文件服务，不建议长期使用 `vite preview` 作为正式服务。

## 13. 演进路线

### P0：工程与稳定性

- 统一项目命名和部署目录，明确 `newchat` 与 `chat-app` 的关系。
- 添加 `.gitignore`，排除 `node_modules`、`dist`、`.env`、备份文件。
- 添加 `.env.example` 和配置校验。
- 将 `GroupsService` 中的会话逻辑迁移到 `ConversationsService`。
- 为 REST 请求补全 DTO。
- 修复消息 cursor 分页。
- 增加基础 e2e 测试：注册、登录、单聊、群聊、发消息。

### P1：Telegram 核心体验

- 文件/图片消息。
- 回复、转发、引用预览。
- 消息搜索和会话内搜索。
- 会话详情媒体库和文件列表。
- 多设备在线状态。
- 未读分割线、跳转最新消息、加载更早消息。
- 群角色管理、邀请链接。
- 站内通知和浏览器通知。

### P2：扩展能力

- 频道 Channel。
- 公开群和群目录。
- 联系人、拉黑、隐私设置。
- 群公告、置顶消息。
- 链接列表。
- Bot API 简化版。
- Redis adapter、消息队列、对象存储。

## 14. 当前风险

- `newchat` 目录与实际运行目录不一致，容易导致部署和维护误操作。
- `.env`、`dist`、`node_modules`、备份文件出现在工作区，版本管理边界不清。
- JWT 默认 secret 为 `secret`，生产环境存在安全风险。
- 自动化测试覆盖不足，当前主要依赖构建和手工验证。
- 通知能力尚未落地，未读提醒仍停留在会话列表内。
- `Chat.tsx` 状态过多，继续加功能会难以维护。

## 15. 近期落地建议

优先顺序：

1. 清理工程边界和配置安全。
2. 补充基础 e2e 测试：注册、登录、单聊、群聊、文件消息、邀请入群。
3. 将 `Chat.tsx` 拆为会话、消息、详情、Socket 等 hooks。
4. 落地站内通知和浏览器通知。
5. 补全群公告、置顶消息、联系人和拉黑等扩展能力。

这条路线能在不推翻现有 NestJS + React 架构的前提下，把当前应用从基础聊天应用平滑演进为更接近 Telegram 的实时通信产品。
