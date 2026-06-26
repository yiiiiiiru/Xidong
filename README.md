# 溪东社区智慧养老 MVP

> 让 15 名社工通过无感传感器 + 智能融合规则 + 钉钉协同，把独居老人异常事件响应时间从「两天后发现」缩短到「30 分钟内响应」。

## 项目结构

```
├── xidong-api/          # 后端 — TypeScript + Node.js 18
├── xidong-h5/           # 前端 — Vue 3 + Vite + Vant 4
├── CODE-MANUAL.md       # 代码说明书（每个文件对应的功能）
├── DEPLOYMENT-GUIDE.md  # 部署与配置指南（数据库/钉钉/涂鸦）
└── AI-CODING-MASTER-PROMPT.md  # 项目 PRD/Spec
```

## 技术栈

| 层 | 选型 |
|----|------|
| 后端 | TypeScript + Node.js 18（阿里云 FC 3.0） |
| 前端 | Vue 3 + Vite + Vant 4 + Pinia |
| 数据库 | MySQL 8.0 + Redis 7 |
| 设备接入 | 涂鸦 IoT（HTTP Webhook / Pulsar） |
| 通知 | 钉钉（群机器人 + 互动卡片 + 语音双呼） |
| 测试 | Vitest（58 用例全通过） |
| 校验 | Zod |

## 快速开始

```bash
# 1. 启动数据库
cd xidong-api && docker-compose up -d

# 2. 安装依赖
npm install
cd ../xidong-h5 && npm install

# 3. 配置环境变量
cd ../xidong-api && cp .env.example .env

# 4. 启动后端
npm run dev    # → http://localhost:7071

# 5. 启动前端
cd ../xidong-h5 && npm run dev    # → http://localhost:5173
```

## 核心功能

### 规则引擎（12 条规则）

| 等级 | 规则 | 说明 |
|------|------|------|
| P0 | R-BTN / R-MIX-01 / R-MIX-02 | 一键报警 / 夜间离床+厕所有人 / 应睡未睡+门未开 |
| P1 | R-BED-01~04 / R-BATH-01 | 离床超时 / 应睡未睡 / 整夜在床<1h / 连续在床>12h / 卫生间滞留 |
| P2 | R-DOOR-01~02 / R-DEV-01~02 | 72h未出门 / 门长开 / 24h无事件 / 电量低 |

### 告警状态机

```
pending → processing → closed
                    → closed_false_positive
                    → dispatched → closed
```

### RBAC 权限

| 角色 | 权限 |
|------|------|
| social_worker | 全部告警 + 档案读写 |
| building_manager | 本楼栋告警 + 脱敏档案 |
| property | 仅 P0 告警 + 到场回填 |
| director | 全部只读 |

## 文档索引

- **[CODE-MANUAL.md](./CODE-MANUAL.md)** — 每个文件的功能说明 + PRD 对照表
- **[DEPLOYMENT-GUIDE.md](./DEPLOYMENT-GUIDE.md)** — 数据库管理 / 钉钉配置 / 涂鸦接入 / 阿里云部署
- **[AI-CODING-MASTER-PROMPT.md](./AI-CODING-MASTER-PROMPT.md)** — 完整 PRD 规范

## 开发状态

- [x] 后端 22 个源文件全部就位
- [x] 前端 9 个页面 + 4 个组件
- [x] 12 条规则引擎 100% 实现
- [x] Zod 入参校验 + RBAC 中间件
- [x] 5 个测试文件 58 个用例通过
- [ ] 阿里云 FC 部署
- [ ] 涂鸦硬件设备接入
- [ ] 钉钉应用上线配置
