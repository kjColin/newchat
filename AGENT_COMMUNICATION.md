# Agent 内部通信指南

> 本指南供各 agent 使用，通过 Redis + SQLite 与 Main Agent 通信

---

## 任务接收

### 方式 1：Redis 任务队列（推荐）

```bash
# 查看分配给你的任务
redis-cli LRANGE agent:<你的agent-id>:pending_tasks 0 -1

# 例如查看 arch 的任务
redis-cli LRANGE agent:arch:pending_tasks 0 -1
```

### 方式 2：SQLite 任务表

```bash
# 查看你的待办任务
sqlite3 /root/.openclaw/workspace/multi-agent-status/notifications.db \
  "SELECT * FROM tasks WHERE agent='<你的agent-id>' AND status='pending';"
```

---

## 状态更新

### 任务开始

```bash
# 使用 update_status.sh 脚本
/root/.openclaw/workspace/multi-agent-status/update_status.sh <agent-id> running

# 或直接操作 SQLite
sqlite3 /root/.openclaw/workspace/multi-agent-status/notifications.db \
  "UPDATE tasks SET status='running', updated_at=datetime('now') WHERE agent='<agent-id>' AND status='pending';"
```

### 任务完成

```bash
/root/.openclaw/workspace/multi-agent-status/update_status.sh <agent-id> done

# 或
sqlite3 /root/.openclaw/workspace/multi-agent-status/notifications.db \
  "UPDATE tasks SET status='done', updated_at=datetime('now') WHERE agent='<agent-id>' AND status='running';"
```

---

## 发送心跳

```bash
# Redis 心跳
redis-cli SET agent:<agent-id>:ping "{\"time\":$(date +%s),\"status\":\"online\"}" EX 60

# SQLite 心跳
sqlite3 /root/.openclaw/workspace/multi-agent-status/notifications.db \
  "UPDATE agents SET last_heartbeat=datetime('now'), status='running' WHERE agent_id='<agent-id>';"
```

---

## 快速参考

| Agent | agent-id |
|---|---|
| arch | `arch` |
| frontend | `frontend` |
| backend | `backend` |
| qa-audit | `qa-audit` |
| ops-deploy | `ops-deploy` |

---

## 示例命令

### arch 查看任务
```bash
redis-cli LRANGE agent:arch:pending_tasks 0 -1
```

### arch 开始任务
```bash
/root/.openclaw/workspace/multi-agent-status/update_status.sh arch running
```

### arch 完成任务
```bash
/root/.openclaw/workspace/multi-agent-status/update_status.sh arch done
```

---

## 注意事项

1. 所有路径都是**绝对路径**
2. Redis 端口：`6379`
3. SQLite 数据库：`/root/.openclaw/workspace/multi-agent-status/notifications.db`
4. 任务完成后**务必更新状态**，否则无法接收新任务