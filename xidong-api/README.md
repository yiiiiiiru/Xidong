# xidong-api — 后端 API

TypeScript + Node.js 18，本地开发用 HTTP server，生产部署到阿里云 FC 3.0。

## 快速开始

```bash
# 1. 启动 MySQL + Redis
docker-compose up -d

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env

# 4. 启动开发服务器
npm run dev
# → http://localhost:7071/api/health

# 5. 跑测试
npm test
```

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/health | 健康检查 |
| GET | /api/alerts | 告警列表（分页/筛选 level/status/elder_id） |
| GET | /api/alerts/:id | 告警详情 + 时间线 |
| PUT | /api/alerts/:id/handle | 告警处置（acknowledge/safe/false_positive/dispatch/visit_done） |
| GET | /api/elders | 档案列表 |
| GET | /api/elders/:id | 档案详情 |
| POST | /api/elders/import | Excel 导入 |
| PUT | /api/elders/:id/status | 状态管理（外出/住院/暂停） |
| POST | /api/webhook/tuya | 涂鸦设备事件（签名验证） |
| POST | /api/webhook/dingtalk | 钉钉卡片回调 |
| POST | /api/internal/mock-alert | Mock 告警（dev） |
| POST | /api/internal/mock-event | Mock 事件（dev） |
| GET | /api/me/stats | 个人统计 |
| POST | /api/meals/checkin | 食堂签到 |
| GET | /api/meals | 消费记录 |
| GET | /api/meals/stats | 食堂统计 |
| GET/POST/PUT/DELETE | /api/workers | 工作人员管理 |

## 技术栈

- TypeScript 5 + Node.js 18
- MySQL 8.0 (mysql2 raw SQL)
- Redis 7 (ioredis)
- Zod (参数校验)
- Vitest (58 测试用例)
- dayjs (Asia/Shanghai)

## 测试

```bash
npm test
# 5 files, 58 tests passed
```
