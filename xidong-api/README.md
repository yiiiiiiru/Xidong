# 溪东社区智慧养老 MVP — 后端 API

Phase 0-1 Serverless 后端（TypeScript + 阿里云 FC）。

## 快速开始

### 1. 启动数据库

```bash
docker-compose up -d
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env（本地开发用默认值即可）
```

### 4. 执行数据库迁移

```bash
npm run migrate
```

### 5. 启动开发服务器

```bash
npm run dev
# 访问 http://localhost:7071/api/health
```

### 6. 运行测试

```bash
npm test
```

## API 端点

| 方法 | 路径 | 状态 | 说明 |
|------|------|------|------|
| GET | /api/health | ✅ | 健康检查 |
| GET | /api/alerts | 🚧 W1D3 | 告警列表 |
| GET | /api/alerts/:id | 🚧 W1D3 | 告警详情 |
| PUT | /api/alerts/:id/handle | 🚧 W1D3 | 告警处置 |
| GET | /api/elders | 🚧 W1D2 | 档案列表 |
| GET | /api/elders/:id | 🚧 W1D2 | 档案详情 |
| POST | /api/elders/import | 🚧 W1D2 | Excel导入 |
| PUT | /api/elders/:id/status | 🚧 W1D2 | 状态管理 |
| POST | /api/webhook/tuya | 🚧 W2D5 | 涂鸦事件 |
| POST | /api/webhook/dingtalk | 🚧 W1D4 | 钉钉回调 |
| POST | /api/internal/mock-alert | 🚧 W1D3 | Mock告警 |
| GET | /api/me/stats | 🚧 W1D4 | 个人统计 |

## 技术栈

- TypeScript 5 + Node.js 18
- MySQL 8.0 (mysql2)
- Redis 7 (ioredis)
- Zod (参数校验)
- Vitest (测试)
- dayjs (时间处理, Asia/Shanghai)
