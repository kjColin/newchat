# NewChat 架构设计

## 1. 背景

NewChat 是一个面向即时通讯场景的 Web 聊天应用，目标体验参考 Telegram 的核心聊天能力：单聊、群聊、实时消息、在线状态、已读、置顶、免打扰、归档、消息编辑/删除、表情反应、文件消息、搜索与通知。

当前用户提到的 `/root/.openclaw/workspace/newchat` 目录在本机不存在。实际运行目录来自 systemd 服务：

- 后端：`/root/.openclaw/workspace/chat-app/src/backend`
- 前端：`/root/.openclaw/workspace/chat-app/src/frontend`

本文档以当前 `chat-app` 源码为基线，描述目标架构和后续演进方案。

## 2. 架构目标

### 2.1 产品目标

- 支持用户注册、登录、个人资料与头像编辑。
- 支持用户搜索、单聊、群聊、频道、群成员管理、群邀请链接。
- 支持实时消息、输入中、在线状态、已读状态。
- 支持消息编辑、删除、表情反应、回复、转发。
- 支持图片、文件、语音等附件消息。
- 支持会话置顶、免打扰、归档、未读统计。
- 支持消息搜索、会话内搜索、媒体/文件/链接列表、站内通知和浏览器通知。
- 支持后续扩展公开群/频道目录、机器人接口。

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
│ Groups / Channels / Files / Notifications    │
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

当前 `Chat.tsx` 已承载较多状态和事件处理，目标拆分如下；其中 `useNotifications`、`useChatSocket`、`useMessages`、`useConversations`、`useConversationDetails`、`useUserSearch` 和 `useCreateConversation` 已先落地，并已建立 Vitest + Testing Library 的 hook 测试基线：

- `useConversations`：会话列表、置顶、免打扰、归档、未读计数。
- `useMessages`：消息加载、分页、发送、编辑、删除、反应。
- `useChatSocket`：Socket 连接、事件订阅、房间加入、断线重连。
- `useConversationDetails`：详情侧栏、群成员列表、添加成员、移除成员、群信息更新、邀请链接和共享内容。
- `useNotifications`：站内通知列表、已读状态、浏览器通知授权和 Web Push subscription。
- `useUserSearch`：用户搜索、去抖、搜索结果状态。
- `useCreateConversation`：创建群/频道表单状态、提交和创建后会话切换。

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
| `ChannelsModule` | 频道资料、频道成员、频道发言权限 |
| `FilesModule` | 文件上传、下载、附件元数据、缩略图 |
| `PresenceModule` | 在线状态、多设备连接、最后在线时间 |
| `NotificationsModule` | 站内通知持久化、实时通知投递、Web Push 扩展点 |
| `SearchModule` | 用户、会话、消息全文搜索 |

当前代码中会话列表、单聊创建和会话设置已由 `ConversationsService` 负责；`GroupsService` 保留群资料、成员和邀请链接，`ChannelsService` 负责频道资料、成员和发言权限。

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
| `Conversation` | 会话，区分 `direct`、`group` 和 `channel` |
| `UserConversation` | 用户与会话关系，保存已读、置顶、免打扰、归档 |
| `Message` | 消息主体，支持文本、编辑、软删除 |
| `MessageReaction` | 消息表情反应 |
| `PinnedMessage` | 会话置顶消息、置顶人和置顶时间 |
| `Group` | 群资料、群公告、群主、关联会话 |
| `GroupMember` | 群成员和角色 |
| `Channel` | 频道资料、频道主、关联会话 |
| `ChannelMember` | 频道订阅者和角色，owner/admin 可发帖 |
| `Attachment` | 文件/图片等附件元数据 |
| `InviteLink` | 群邀请链接、撤销状态、使用次数 |
| `Contact` | 用户联系人关系和别名 |
| `BlockList` | 用户拉黑关系 |
| `Notification` | 用户站内通知，关联会话和可选消息，保存已读状态 |

### 7.2 建议新增模型

```prisma
model MessageReadReceipt {
  messageId String
  userId    String
  readAt    DateTime @default(now())

  @@id([messageId, userId])
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
| `PATCH` | `/api/users/me` | 更新用户名和头像 |
| `GET` | `/api/users/search?q=` | 搜索用户 |
| `GET` | `/api/users/contacts` | 联系人列表 |
| `POST` | `/api/users/contacts` | 添加联系人 |
| `DELETE` | `/api/users/contacts/:userId` | 移除联系人 |
| `GET` | `/api/users/blocks` | 拉黑列表 |
| `POST` | `/api/users/blocks` | 拉黑用户 |
| `DELETE` | `/api/users/blocks/:userId` | 取消拉黑 |
| `GET` | `/api/conversations` | 会话列表 |
| `POST` | `/api/conversations/direct` | 创建/获取单聊 |
| `PATCH` | `/api/conversations/:id/settings` | 置顶、免打扰、归档 |
| `GET` | `/api/messages/:conversationId` | 消息历史分页 |
| `POST` | `/api/messages` | 发送消息 |
| `PATCH` | `/api/messages/:id` | 编辑消息 |
| `DELETE` | `/api/messages/:id` | 删除消息 |
| `GET` | `/api/messages/:conversationId/links` | 会话链接列表 |
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
| `POST` | `/api/channels` | 创建频道 |
| `GET` | `/api/channels/discover?q=` | 发现公开频道 |
| `PATCH` | `/api/channels/:conversationId` | 更新频道资料 |
| `POST` | `/api/channels/:conversationId/subscribe` | 订阅频道 |
| `DELETE` | `/api/channels/:conversationId/subscribe` | 退订频道 |
| `GET` | `/api/channels/:conversationId/members` | 频道订阅者列表 |
| `POST` | `/api/files` | 上传附件 |
| `GET` | `/api/notifications` | 当前用户通知列表 |
| `PATCH` | `/api/notifications/:notificationId/read` | 标记单条通知已读 |
| `POST` | `/api/notifications/conversations/:conversationId/read` | 标记会话通知已读 |
| `POST` | `/api/notifications/read-all` | 标记全部通知已读 |
| `DELETE` | `/api/notifications` | 清空通知 |

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
| `notification` | Server -> Client | 当前用户的新站内通知 |
| `presence:update` | Server -> Client | 用户在线状态变化 |
| `conversation:updated` | Server -> Client | 会话设置或群信息变化 |
| `group:membersUpdated` | Server -> Client | 群成员变化 |

服务端会基于新消息写入 `Notification`，并向在线接收者推送 `notification` 事件。前端启动后先通过 REST 恢复通知列表，再通过 Socket 增量更新；浏览器通知使用标准 Notification API，由用户授权后启用。

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
  │
  ▼
NotificationsService
  │ create Notification for non-sender participants
  │ skip muted conversations
  │ emit "notification" to online recipients
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

当前单实例实现使用进程内 `userId -> socketIds` 计数；只在最后一个设备断开后才延迟标记 offline，延迟时间由 `PRESENCE_OFFLINE_DELAY_MS` 控制，默认 15000ms。Socket e2e 已覆盖多设备断开时仍保持 online、最后设备断开后变为 offline 的行为。

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

### 9.6 通知保留策略

- `Notification` 是站内通知的可恢复数据源，Socket `notification` 只负责在线增量投递。
- 服务启动后会执行一次通知清理，之后按 `NOTIFICATION_CLEANUP_INTERVAL_MINUTES` 周期执行。
- `NOTIFICATION_RETENTION_DAYS` 控制过期删除，默认 30 天。
- `NOTIFICATION_MAX_PER_USER` 控制每个用户最多保留最近通知数量，默认 100 条。
- 新消息生成通知后会立即对接收者执行上限裁剪，避免高频会话无限增长。
- Web Push 通过 `PushSubscription` 保存浏览器 endpoint 和加密 key；配置 VAPID key 后，服务端在生成站内通知后尝试投递 Push。未配置时自动降级，不影响站内通知、Socket 通知和前台浏览器通知。

## 10. 安全设计

- JWT secret 必须来自环境变量，生产环境禁止默认值。
- 密码使用 bcrypt 哈希，禁止返回 password 字段。
- 所有写接口使用 DTO 和 class-validator。
- 当前用户资料更新需校验用户名唯一性，并允许用户清空头像。
- 所有会话、消息、群操作必须校验参与者或管理员权限。
- 拉黑关系必须由后端强制执行：禁止创建对应单聊，并禁止在已有单聊中继续发送消息。
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
- `ChannelMember(channelId, role)`
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

### 12.3 关键环境变量

后端启动会校验关键运行配置。生产环境必须显式配置：

| 变量 | 说明 |
| --- | --- |
| `DATABASE_URL` | PostgreSQL 连接串 |
| `JWT_SECRET` | JWT 签名密钥，生产环境不得使用默认值 |
| `CORS_ORIGINS` | 允许访问 HTTP 和 Socket API 的前端源，多个源用英文逗号分隔 |
| `HOST` / `PORT` | 后端监听地址和端口 |
| `NOTIFICATION_RETENTION_DAYS` | 通知保留天数 |
| `NOTIFICATION_MAX_PER_USER` | 每个用户最多保留通知数量 |
| `NOTIFICATION_CLEANUP_INTERVAL_MINUTES` | 通知后台清理周期 |
| `PRESENCE_OFFLINE_DELAY_MS` | 最后一个 Socket 断开后标记离线的延迟 |
| `WEB_PUSH_PUBLIC_KEY` / `WEB_PUSH_PRIVATE_KEY` | Web Push VAPID key，生产环境必填 |
| `WEB_PUSH_SUBJECT` | Web Push VAPID subject，例如 `mailto:ops@example.com` |

## 13. 演进路线

### P0：工程与稳定性

- 统一项目命名和部署目录，明确 `newchat` 与 `chat-app` 的关系。
- 添加 `.gitignore`，排除 `node_modules`、`dist`、`.env`、备份文件。
- 添加 `.env.example` 和配置校验。
- 保持 `ConversationsService`、`GroupsService`、`ChannelsService` 的边界清晰。
- 为 REST 请求补全 DTO。
- 修复消息 cursor 分页。
- 已增加 e2e 测试：注册、登录、单聊、群聊、发消息、通知、文件消息、邀请入群、频道订阅/权限、隐私设置。

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

- 频道基础能力：创建频道、频道会话、频道详情、频道管理员发帖、频道发现、订阅和退订。
- 公开群能力：群目录、群发现和公开加入。
- 隐私设置：搜索可见性、陌生人私聊限制。
- 联系人资料页：历史链接按联系人/本人筛选，链接预览包含 hostname 元数据。
- Bot API 简化版。
- Redis adapter、消息队列、对象存储。

## 14. 当前风险

- `newchat` 目录与实际运行目录不一致，容易导致部署和维护误操作。
- `.env`、`dist`、`node_modules`、备份文件出现在工作区，版本管理边界不清。
- 生产环境已强制校验 `JWT_SECRET` 和 `CORS_ORIGINS`；部署时必须提供真实密钥和前端域名。
- 自动化测试已覆盖核心 REST 流程、Socket 实时事件、多设备在线状态和 Web Push 注册降级；真实浏览器 Push 投递仍需要端到端环境验证。
- 站内通知已持久化并支持保留策略；Web Push 已具备可配置投递路径，生产需要配置 VAPID key 并验证浏览器/平台兼容性。
- `Chat.tsx` 已抽出通知状态、Socket 编排、消息状态、会话列表、详情侧栏、用户搜索和创建会话表单 hook，并已为创建会话 hook 补上单元测试；后续风险主要在其他 hook/组件测试缺口和工程边界清理。

## 15. 近期落地建议

优先顺序：

1. 清理工程边界，统一 `newchat` 与 `chat-app` 的部署目录关系。
2. 在真实浏览器环境验证 Web Push 投递、权限拒绝和 subscription 失效清理。
3. 在已建立的 Vitest + Testing Library 基线上，继续为通知、Socket、消息、会话、详情、用户搜索等 hook 补测试。
4. 规划 Redis adapter、对象存储和消息队列接入。
5. 将 `Chat.tsx` 拆分后的 hooks 接入组件测试。

这条路线能在不推翻现有 NestJS + React 架构的前提下，把当前应用从基础聊天应用平滑演进为更接近 Telegram 的实时通信产品。
