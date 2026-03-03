# Chat-App 协作开发项目

## 分支策略
- `main`: 主分支，保持稳定可发布
- `feature/*`: 特性分支，每人开发新功能使用
- `bugfix/*`: 修复分支

## 协作流程
1. 从 `main` 创建新分支: `git checkout -b feature/xxx`
2. 开发完成后提交: `git commit -m "描述"`
3. 推送并创建 MR: `git push -u origin feature/xxx`
4. 代码审查后合并到 `main`

## 项目结构
```
chat-app/
├── src/          # 源代码
├── tests/        # 测试代码
├── docs/         # 文档
└── .gitlab-ci.yml  # CI/CD 配置
```

## 成员
- arch: 架构设计
- frontend: 前端开发
- backend: 后端开发
- qa-audit: 测试
- ops-deploy: 部署
