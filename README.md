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

---

## 代码说明书

> 对照规范：AI-CODING-MASTER-PROMPT.md v2.0（Phase 0-1, W1–W4）  
> 自检结果：后端 tsc ✅ | vitest 58 tests ✅ | 前端 vue-tsc ✅ | vite build ✅

### 整体完成度

| 维度 | 完成度 | 说明 |
|------|--------|------|
| 后端代码 | **95%** | 全部 handler/service/rules/dao 就位 |
| 前端代码 | **90%** | 全部页面+组件+路由就位 |
| 数据库 | **100%** | 10 张表 DDL + DAO 全覆盖 |
| 规则引擎 | **100%** | 12 条规则全部实现 + 抑制/去重/升级 |
| 单元测试 | **85%** | 5 个测试文件 58 用例 |
| 基础设施 | **100%** | docker-compose + migrations + scripts |

### 后端文件清单 — xidong-api/

#### 入口 & 基础设施

| 文件 | 行数 | PRD 对应 | 功能说明 |
|------|------|----------|----------|
| `src/index.ts` | 340 | §5 API 契约 | HTTP server 入口，路由注册+分发，RBAC 拦截，CORS |
| `src/types/index.ts` | 146 | §4.2 核心接口 | 全局 TS 类型：SensorEvent, ElderContext, AlertCandidate, AlertAction, AuthUser 等 |
| `src/schemas.ts` | 109 | §1 Zod 校验 | Zod schema：HandleAlertSchema, ElderImportSchema, TuyaWebhookSchema 等 |
| `migrations/001_mvp.sql` | 201 | §3 数据模型 | 10 张表 DDL |
| `docker-compose.yml` | — | §9 环境变量 | MySQL 8.0 + Redis 7 本地开发环境 |
| `.env.example` | — | §9 环境变量 | 所有环境变量模板 |

#### 数据访问层 — db/

| 文件 | 行数 | 功能说明 |
|------|------|----------|
| `src/db/mysql.ts` | 19 | MySQL 连接池 |
| `src/db/redis.ts` | 33 | ioredis 客户端 + RedisKeys 命名空间 |
| `src/db/dao.ts` | 616 | 8 个 DAO：ElderDao, EmergencyContactDao, ElderStatusDao, MealDao, WorkerDao, AlertDao, SensorEventDao, DeviceDao |

#### 业务处理器 — handlers/

| 文件 | 行数 | 功能说明 |
|------|------|----------|
| `src/handlers/alert.ts` | 238 | 告警 CRUD + 状态机（pending→processing→closed/closed_fp/dispatched→closed） |
| `src/handlers/elder.ts` | 278 | 档案 CRUD + 楼长脱敏 |
| `src/handlers/webhook.ts` | 316 | 涂鸦 Webhook（签名验证+事件解析+规则评估）/ 钉钉卡片回调 |
| `src/handlers/internal.ts` | 139 | mockAlert / mockEvent / seedDevices（dev 调试） |
| `src/handlers/stats.ts` | 31 | 个人统计 |
| `src/handlers/meal.ts` | 242 | 食堂签到/导入/查询/统计 |
| `src/handlers/worker.ts` | 161 | 工作人员 CRUD |

#### 规则引擎 — rules/

| 文件 | 行数 | 功能说明 |
|------|------|----------|
| `src/rules/engine.ts` | 562 | ingestEvent + evaluate（12条规则）+ pipeline（evaluate→suppress→dedup） |
| `src/rules/rules.json` | 146 | 12 条规则配置：id, level, penetrateSuppress, skipDedup |
| `src/rules/status-guard.ts` | 86 | 状态抑制（away/hospital/paused）+ R-BTN 穿透 |
| `src/rules/dedup.ts` | 90 | 5min 窗口去重 + skipDedup 豁免 |

**12 条规则：**

| 规则 | 等级 | 判定逻辑 |
|------|------|----------|
| R-BTN | P0 | 一键报警，10s 内有效，永不抑制/不去重 |
| R-MIX-01 | P0 | 夜间 + 离床≥30min + 厕所PIR有人 |
| R-MIX-02 | P0 | 超就寝截止 + 未上床 + 门未开 + 厕所无人 |
| R-BED-01 | P1 | 夜间离床≥阈值 + 厕所无人 |
| R-BED-02 | P1 | 超就寝截止 + 未上床 |
| R-BED-03 | P1 | 06:00-07:00 窗口，夜间在床累计<1h |
| R-BED-04 | P1 | 连续在床>12h |
| R-BATH-01 | P1 | 厕所PIR≥60min（冷启动7天） |
| R-DOOR-01 | P2 | 72h未出门（homebound豁免） |
| R-DOOR-02 | P2 | 门开≥30min |
| R-DEV-01 | P2 | 24h无事件 |
| R-DEV-02 | P2 | 电量<20% |

#### 服务层 — services/

| 文件 | 行数 | 功能说明 |
|------|------|----------|
| `src/services/notify.ts` | 184 | 群机器人推送 + 签名 + P1 夜间勿扰 23:00-06:00 |
| `src/services/dingtalk.ts` | 149 | AccessToken缓存 + 互动卡片 + 语音双呼(VOICE_MOCK) + 免登 |
| `src/services/escalation.ts` | 197 | 3轮升级：社工→备班+主管→@all+director |
| `src/services/tuya.ts` | 88 | Pulsar 消费者 stub（TUYA_MOCK），待硬件到位后接入 SDK |

#### 中间件 & 脚本 & 测试

| 文件 | 说明 |
|------|----------|
| `src/middleware/rbac.ts` | 角色解析 + 权限检查 + 楼长脱敏 |
| `scripts/migrate.ts` | 执行 SQL migration |
| `scripts/seed-mock.ts` | 插入 mock 数据 |
| `scripts/simulate-day.ts` | 模拟 24h 传感器事件流 |
| `tests/rules/engine.test.ts` | 16 用例：抑制逻辑 + rules.json 完整性 |
| `tests/rules/eval.test.ts` | 24 用例：8 条规则各 3 个用例 |
| `tests/rules/dedup.test.ts` | 5 用例：去重逻辑 |
| `tests/handlers/alert.test.ts` | 8 用例：状态机转换 |
| `tests/services/notify.test.ts` | 5 用例：通知推送 |

### 前端文件清单 — xidong-h5/

#### 页面

| 文件 | 行数 | 功能说明 |
|------|------|----------|
| `views/Workbench.vue` | 107 | 工作台首页（三 Tab + AlertCard 列表 + 下拉刷新） |
| `views/AlertDetail.vue` | 255 | 告警详情 + Timeline + 操作按钮 |
| `views/ElderList.vue` | 124 | 搜索 + 风险等级筛选 + 分页 |
| `views/ElderDetail.vue` | 395 | 基本信息 + 设备列表 + 告警历史 + 状态设置 |
| `views/Me.vue` | 134 | 统计数据 + 用户信息 |
| `views/FpStats.vue` | 137 | 误报率统计 + 按规则/原因聚合 |
| `views/MealCheck.vue` | 258 | 食堂签到 + 导入 + 统计 |
| `views/Admin.vue` | 200 | 工作人员增删改查 |
| `views/building/BuildingAlerts.vue` | 101 | 本楼栋告警列表 |

#### 组件

| 文件 | 行数 | 功能说明 |
|------|------|----------|
| `components/AlertCard.vue` | 133 | 告警卡片：等级 + 姓名 + 规则 + 状态 + 时间 |
| `components/Timeline.vue` | 123 | 告警处理时间线 |
| `components/StatusModal.vue` | 190 | 老人状态弹窗（外出/住院/暂停 + 日期） |
| `components/AppTabbar.vue` | 28 | 底部导航栏 |

#### 工具 & 状态

| 文件 | 功能说明 |
|------|----------|
| `api/index.ts` | axios 封装 + 请求拦截 + alertApi/elderApi/statsApi/mealApi |
| `stores/user.ts` | Pinia 状态：useUserStore (setUser/mockLogin/logout) |
| `utils/dingtalk.ts` | 钉钉免登（生产 authCode + DEV mockLogin） |
| `router/index.ts` | 全部路由注册 |
| `styles/theme.css` | Vant CSS 变量覆盖 |

### PRD 对照表

| PRD 章节 | 实现状态 | 对应文件 |
|----------|----------|----------|
| §1 技术栈 | ✅ | tsconfig, package.json |
| §3 数据模型 (10张表) | ✅ | migrations/001_mvp.sql + dao.ts |
| §4 规则引擎 | ✅ | rules/engine.ts + rules.json + status-guard + dedup |
| §5 API 契约 | ✅ | index.ts + handlers/* |
| §6 RBAC 权限 | ✅ | rbac.ts + index.ts 路由层 |
| §7 钉钉集成 | ✅ | notify.ts + dingtalk.ts + escalation.ts + 前端 dingtalk.ts |
| §8 误报反馈 | ✅ | FpStats.vue + AlertDao.addFalsePositiveLog |
| §10 降级开关 | ✅ | VOICE_MOCK / TUYA_MOCK / BASELINE_FIXED |

### 尚未完成 / 待运行时验证

| # | 项目 | 性质 | 说明 |
|---|------|------|------|
| 1 | 真实 MySQL/Redis 连接 | 运行时 | docker-compose up 后验证 |
| 2 | 涂鸦 Pulsar 连接 | 硬件依赖 | tuya.ts 为 stub，待设备到位 |
| 3 | 钉钉应用配置 | 外部服务 | 填入 APP_KEY/SECRET 后验证 |
| 4 | JWT 鉴权替换 | W2 规划 | 当前用 header X-User-Id/X-Role |
| 5 | 前端测试 | 低优 | MVP 阶段未强制要求 |

### 代码行数统计

| 模块 | 文件数 | 总行数 |
|------|--------|--------|
| xidong-api/src | 22 | ~4,100 |
| xidong-api/tests | 5 | ~1,050 |
| xidong-api/scripts | 3 | ~410 |
| xidong-h5/src | 26 | ~3,400 |
| **合计** | **56** | **~9,000** |
