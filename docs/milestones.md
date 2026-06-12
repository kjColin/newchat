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
| 单元测试 | qa-audit | ⏳ |
| 集成测试 | qa-audit | ⏳ |

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
| 消息已读状态 | backend | ✅ |
| 用户头像 | frontend | ⏳ |
| 搜索功能 | backend | ✅ |
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
Milestone 2: ████████░░ 80%
Milestone 3: ██████░░░░ 60%
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
