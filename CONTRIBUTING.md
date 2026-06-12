# 协作开发指南

## 1. 分支管理

| 分支 | 用途 | 命名规范 |
|---|---|---|
| `main` | 稳定可发布版本 | - |
| `feature/*` | 新功能开发 | feature/功能名 |
| `bugfix/*` | Bug 修复 | bugfix/问题描述 |
| `docs/*` | 文档更新 | docs/文档名 |

## 2. 开发流程

```bash
# 1. 拉取最新代码
git checkout main
git pull origin main

# 2. 创建新分支
git checkout -b feature/your-feature

# 3. 开发并提交
git add .
git commit -m "描述你的改动"

# 4. 推送并创建 MR
git push -u origin feature/your-feature
```

## 3. MR 合并规则

- ✅ 必须通过 CI 测试
- ✅ 至少 1 人 Code Review 通过
- ✅ 无冲突

## 4. 各 Agent 任务

| Agent | 任务 | 分支 |
|---|---|---|
| arch | 架构设计 | feature/architecture |
| frontend | 前端开发 | feature/frontend-* |
| backend | 后端开发 | feature/backend-* |
| qa-audit | 测试 | feature/tests |
| ops-deploy | 部署配置 | feature/ci-cd |
