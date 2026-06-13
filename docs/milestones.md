# 项目里程碑

## 版本计划

### Milestone 1: MVP (最小可行产品)
**目标日期**: 2026-03-10

| 任务 | 负责人 | 状态 |
|------|--------|------|
| 项目初始化 | arch | ✅ |
| 架构设计文档 | arch | ✅ |
| 后端基础框架搭建 | backend | ✅ |
| 前端基础框架搭建 | frontend | ✅ |
| 用户注册/登录 | backend | ✅ |
| 登录页面 | frontend | ✅ |
| Docker 配置 | ops-deploy | ⏳ |
| GitLab CI 基础 | ops-deploy | ⏳ |

**交付物**:
- 基本可运行的聊天应用
- 用户注册登录功能
- 简单的单聊

---

### Milestone 2: 核心功能
**目标日期**: 2026-03-17

| 任务 | 负责人 | 状态 |
|------|--------|------|
| 群组功能 | backend | ✅ |
| 群邀请链接 | fullstack | ✅ |
| WebSocket 实时消息 | backend | ✅ |
| 聊天界面 | frontend | ✅ |
| 群组列表 | frontend | ✅ |
| 加载更早消息/未读分割线/跳转最新 | frontend | ✅ |
| 单元测试 | qa-audit | ⏳ |
| 基础 e2e 集成测试 | qa-audit | ✅ |

**交付物**:
- 完整聊天功能
- 群组功能
- 实时消息推送

---

### Milestone 3: 增强功能
**目标日期**: 2026-03-24

| 任务 | 负责人 | 状态 |
|------|--------|------|
| 文件上传/下载 | backend | ✅ |
| 会话媒体/文件列表 | fullstack | ✅ |
| 会话链接列表 | fullstack | ✅ |
| 置顶消息 | fullstack | ✅ |
| 群公告 | fullstack | ✅ |
| 消息已读状态 | backend | ✅ |
| 用户头像/资料编辑 | fullstack | ✅ |
| 搜索功能 | backend | ✅ |
| 站内通知/浏览器通知 | frontend | ✅ |
| 联系人/拉黑 | fullstack | ✅ |
| 频道基础/发现/订阅 | fullstack | ✅ |
| 公开群目录/发现/加入 | fullstack | ✅ |
| 隐私设置 | fullstack | ✅ |
| 联系人历史链接筛选 | fullstack | ✅ |
| 性能优化 | all | ⏳ |

**交付物**:
- 文件分享
- 已读回执
- 搜索功能

---

### Milestone 4: 生产环境
**目标日期**: 2026-03-31

| 任务 | 负责人 | 状态 |
|------|--------|------|
| Docker Compose | ops-deploy | ⏳ |
| CI/CD 完善 | ops-deploy | ⏳ |
| 监控配置 | ops-deploy | ⏳ |
| 文档完善 | all | ⏳ |
| 安全审计 | qa-audit | ⏳ |

**交付物**:
- 生产就绪的应用
- 自动化部署
- 监控告警

---

## 当前进度

```
Milestone 1: ████████░░ 80%
Milestone 2: █████████░ 90%
Milestone 3: ██████████ 100%
Milestone 4: ░░░░░░░░░░  0%
```

---

## 依赖关系

```
Milestone 1
    │
    ├── backend init → arch done
    ├── frontend init → arch done
    ├── docker → backend done
    └── ci → docker done

Milestone 2
    │
    ├── ws → backend init
    ├── chat UI → ws
    └── tests → backend core

Milestone 3
    │
    ├── files → milestone 2
    └── search → milestone 2

Milestone 4
    │
    ├── compose → all milestones
    └── monitor → compose
```

---

**最后更新**: 2026-06-13
