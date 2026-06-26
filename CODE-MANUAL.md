# 溪东社区智慧养老 MVP — 代码说明书

> **生成日期**：2026-06-25  
> **对照规范**：AI-CODING-MASTER-PROMPT.md v2.0（Phase 0-1, W1–W4）  
> **自检结果**：后端 tsc ✅ | vitest 58 tests ✅ | 前端 vue-tsc ✅ | vite build ✅

---

## 一、整体完成度总览

| 维度 | 完成度 | 说明 |
|------|--------|------|
| 后端代码 | **95%** | 全部 handler/service/rules/dao 就位 |
| 前端代码 | **90%** | 全部页面+组件+路由就位 |
| 数据库 | **100%** | 10 张表 DDL + DAO 全覆盖 |
| 规则引擎 | **100%** | 12 条规则全部实现 + 抑制/去重/升级 |
| 单元测试 | **85%** | 5 个测试文件 58 用例 |
| 基础设施 | **100%** | docker-compose + migrations + scripts |

---

## 二、后端文件清单 — xidong-api/

### 2.1 入口 & 基础设施

| 文件 | 行数 | PRD 对应 | 功能说明 |
|------|------|----------|----------|
| `src/index.ts` | 340 | §5 API 契约 | HTTP server 入口，路由注册+分发，RBAC 拦截，CORS |
| `src/types/index.ts` | 146 | §4.2 核心接口 | 全局 TS 类型：SensorEvent, ElderContext, AlertCandidate, AlertAction, AuthUser 等 |
| `src/schemas.ts` | 109 | §1 Zod 校验 | Zod schema 定义：HandleAlertSchema, ElderImportSchema, TuyaWebhookSchema 等 |
| `migrations/001_mvp.sql` | 201 | §3 数据模型 | 10 张表 DDL（elder, emergency_contact, elder_status, device, sensor_event, alert, alert_timeline, false_positive_log, meal_check, social_worker） |
| `docker-compose.yml` | — | §9 环境变量 | MySQL 8.0 + Redis 7 本地开发环境 |
| `.env.example` | — | §9 环境变量 | 所有环境变量模板 |

### 2.2 数据访问层 — db/

| 文件 | 行数 | PRD 对应 | 功能说明 |
|------|------|----------|----------|
| `src/db/mysql.ts` | 19 | §1 mysql2 | MySQL 连接池（mysql2/promise） |
| `src/db/redis.ts` | 33 | §3 Redis Key 设计 | ioredis 客户端 + RedisKeys 命名空间（evt/state/dedup/fp/escalation） |
| `src/db/dao.ts` | 616 | §3 全部 10 张表 | 8 个 DAO：ElderDao, EmergencyContactDao, ElderStatusDao, MealDao, WorkerDao, AlertDao, SensorEventDao, DeviceDao |

### 2.3 业务处理器 — handlers/

| 文件 | 行数 | PRD 对应 | 功能说明 |
|------|------|----------|----------|
| `src/handlers/alert.ts` | 238 | §5.1 告警 API | createAlert / listAlerts / getAlertDetail / handleAlert（状态机：pending→processing→closed/closed_fp/dispatched→closed） |
| `src/handlers/elder.ts` | 278 | §5.2 档案 API | listElders / getElderDetail / importElders / setElderStatus / updateElder / deleteElder + 楼长脱敏 |
| `src/handlers/webhook.ts` | 316 | §5.3 Webhook | handleTuyaWebhook（签名验证+事件解析+规则评估+sensor_event落库）/ handleDingtalkWebhook（卡片回调） |
| `src/handlers/internal.ts` | 139 | §5.3 内部 | mockAlert / mockEvent / seedDevices（dev 调试工具） |
| `src/handlers/stats.ts` | 31 | §5.3 GET /me/stats | 个人统计：pending/processing/today_closed/total_elders |
| `src/handlers/meal.ts` | 242 | §5.3 食堂 | checkinMeal / importMeals / listMeals / mealStats / updateMeal / cancelMeal |
| `src/handlers/worker.ts` | 161 | §6 RBAC（人员管理） | listWorkers / getWorkerDetail / createWorker / updateWorker / deleteWorker |

### 2.4 规则引擎 — rules/

| 文件 | 行数 | PRD 对应 | 功能说明 |
|------|------|----------|----------|
| `src/rules/engine.ts` | 562 | §4 规则引擎全部 | ingestEvent（事件摄入+Redis state更新+computeBedAccum）/ evaluate（12条规则判定）/ pipeline（evaluate→suppress→dedup） |
| `src/rules/rules.json` | 146 | §4.1 规则注册表 | 12 条规则配置：id, level, planLevels, penetrateSuppress, skipDedup, condition |
| `src/rules/status-guard.ts` | 86 | §4.3 关键约束 | applySuppression（away/hospital/paused 抑制，R-BTN penetrate）/ getEffectiveStatus（窗口过期恢复） |
| `src/rules/dedup.ts` | 90 | §3 Redis dedup key | applyDedup（5min 窗口去重，skipDedup 豁免） |

**12 条规则实现对照：**

| 规则 | eval 函数 | 判定逻辑 |
|------|-----------|----------|
| R-BTN | evalButtonHold | last_button 10s 内有效 → P0 |
| R-MIX-01 | evalMix01 | 夜间 + 离床≥30min + 厕所PIR有人 → P0 |
| R-MIX-02 | evalMix02 | 超就寝截止 + 未上床 + 门未开 + 厕所无人 → P0 |
| R-BED-01 | evalBed01 | 夜间离床≥阈值 + 厕所无人 → P1 |
| R-BED-02 | evalBed02 | 超就寝截止 + 未上床 → P1 |
| R-BED-03 | evalBed03 | 06:00-07:00 评估窗口，夜间在床累计<1h → P1 |
| R-BED-04 | evalBed04 | 连续在床>12h → P1 |
| R-BATH-01 | evalBath01 | 厕所PIR≥阈值（冷启动7天→60min）→ P1 |
| R-DOOR-01 | evalDoor01 | 72h未出门（homebound豁免）→ P2 |
| R-DOOR-02 | evalDoor02 | 门开≥30min → P2 |
| R-DEV-01 | evalDev01 | 24h无事件 → P2 |
| R-DEV-02 | evalDev02 | 电量<20% → P2 |

### 2.5 服务层 — services/

| 文件 | 行数 | PRD 对应 | 功能说明 |
|------|------|----------|----------|
| `src/services/notify.ts` | 184 | §7.1 通知分级 | notifyAlert（群机器人 Markdown 推送 + 签名计算）/ notifyEscalation（@手机号升级通知）/ P1 夜间勿扰 23:00-06:00 |
| `src/services/dingtalk.ts` | 149 | §7 钉钉集成 | getAccessToken（自动缓存）/ sendInteractiveCard（互动卡片）/ initiateVoiceCall（语音双呼，VOICE_MOCK）/ getUserInfo（免登） |
| `src/services/escalation.ts` | 197 | §7.2 双呼升级 | startEscalation（3轮升级：社工→备班+主管→@all+director）/ checkEscalationTimeout / Redis Hash 状态跟踪 |
| `src/services/tuya.ts` | 88 | §1 涂鸦 Pulsar | startTuyaConsumer（TUYA_MOCK stub）/ parsePulsarPayload — 待硬件到位后接入真实 SDK |

### 2.6 中间件 — middleware/

| 文件 | 行数 | PRD 对应 | 功能说明 |
|------|------|----------|----------|
| `src/middleware/rbac.ts` | 41 | §6 RBAC 矩阵 | parseAuthUser（从 header 解析身份）/ requireRole（角色检查）/ sanitizeForBuildingManager（楼长脱敏：phone/chronic_disease/id_card） |

**RBAC 实际接入点（index.ts 路由层）：**
- property 角色 GET /alerts 强制 level=P0
- building_manager 强制 building 过滤
- 告警处置限 social_worker/property/director
- 档案写入限 social_worker/director
- 工作人员管理限 social_worker/director

### 2.7 脚本 — scripts/

| 文件 | 行数 | PRD 对应 | 功能说明 |
|------|------|----------|----------|
| `scripts/migrate.ts` | 46 | — | 执行 SQL migration |
| `scripts/seed-mock.ts` | 79 | — | 插入 mock 数据（老人+设备+社工） |
| `scripts/simulate-day.ts` | 284 | §4 规则引擎 | 模拟一位老人 24h 传感器事件流，验证规则触发 |

### 2.8 测试 — tests/

| 文件 | 行数 | 用例数 | 覆盖内容 |
|------|------|--------|----------|
| `tests/rules/engine.test.ts` | 265 | 16 | StatusGuard 抑制逻辑 + rules.json 完整性（12条、等级分布、R-BTN 穿透标记） |
| `tests/rules/eval.test.ts` | 401 | 24 | 8 条规则各 3 个用例（触发/不触发/边界），mock Redis |
| `tests/rules/dedup.test.ts` | 114 | 5 | 首次通过 / 重复抑制 / skipDedup 豁免 / 已抑制跳过 / 混合场景 |
| `tests/handlers/alert.test.ts` | 149 | 8 | 状态机 5 条合法转换 + 3 条非法场景 |
| `tests/services/notify.test.ts` | 120 | 5 | 正常推送 / ENABLED=false / webhook 未配 / fetch 失败 / errcode 非零 |

---

## 三、前端文件清单 — xidong-h5/

### 3.1 应用骨架

| 文件 | 行数 | PRD 对应 | 功能说明 |
|------|------|----------|----------|
| `src/main.ts` | 10 | — | createApp + Pinia + Router 挂载 |
| `src/App.vue` | 3 | — | `<router-view />` 壳 |
| `src/router/index.ts` | 71 | §2.2 目录结构 | 全部路由：/, /alert/:id, /elders, /elder/:id, /me, /me/fp-stats, /meal, /admin, /building |
| `src/api/index.ts` | 145 | §5 API 契约 | axios 封装 + 请求拦截（注入 X-User-Id/X-Role/X-Building）+ alertApi/elderApi/statsApi/mealApi |
| `src/stores/user.ts` | 67 | §2.2 Pinia 状态 | useUserStore：setUser/mockLogin/logout，MVP 自动 mockLogin |

### 3.2 页面 — views/

| 文件 | 行数 | PRD 对应 | 功能说明 |
|------|------|----------|----------|
| `src/views/Workbench.vue` | 107 | §2.2 告警工作台 | 三 Tab（待处理/处理中/已关闭）+ AlertCard 列表 + 下拉刷新 |
| `src/views/AlertDetail.vue` | 255 | §5.1 告警详情 | 告警信息 + Timeline 组件 + 操作按钮（确认/安全/误报/转派） |
| `src/views/ElderList.vue` | 124 | §5.2 档案列表 | 搜索 + 风险等级筛选 + 分页 |
| `src/views/ElderDetail.vue` | 395 | §5.2 档案详情 | 基本信息 + 设备列表 + 告警历史 + StatusModal 状态设置 |
| `src/views/Me.vue` | 134 | §2.2 个人中心 | 统计数据 + 用户信息（从 Pinia store）+ 跳转误报统计 |
| `src/views/FpStats.vue` | 137 | §8 误报反馈 | 误报率统计 + 按规则/原因聚合分布 |
| `src/views/MealCheck.vue` | 258 | §5.3 食堂签到 | 签到 + 导入 + 消费记录列表 + 统计 |
| `src/views/Admin.vue` | 200 | §6 RBAC 管理 | 工作人员增删改查 |
| `src/views/building/BuildingAlerts.vue` | 101 | §6 楼长视图 | 本楼栋告警列表（building 过滤） |

### 3.3 组件 — components/

| 文件 | 行数 | PRD 对应 | 功能说明 |
|------|------|----------|----------|
| `src/components/AlertCard.vue` | 133 | §2.2 AlertCard | 告警卡片：等级标签 + 老人姓名 + 规则描述 + 状态 + 时间 |
| `src/components/Timeline.vue` | 123 | §2.2 Timeline | 告警处理时间线：事件类型着色 + 操作人/备注 + 时间格式化 |
| `src/components/StatusModal.vue` | 190 | §2.2 StatusModal | 老人状态弹窗：外出/住院/暂停 + 日期选择 + 备注 |
| `src/components/AppTabbar.vue` | 28 | — | 底部导航栏：工作台/老人/食堂/我的 |

### 3.4 工具 & 样式

| 文件 | 行数 | PRD 对应 | 功能说明 |
|------|------|----------|----------|
| `src/utils/dingtalk.ts` | 104 | §7 钉钉免登 | initDingTalkLogin（生产环境获取 authCode + API 登录 / DEV 环境 mockLogin） |
| `src/styles/theme.css` | 61 | §2.2 Vant 主题 | Vant CSS 变量覆盖（主色/圆角/字号） |

---

## 四、PRD 要求 vs 代码对应关系

### §1 技术栈约定

| 约定 | 实现状态 | 对应文件 |
|------|----------|----------|
| TypeScript + Node 18 | ✅ | `tsconfig.json`, 全部 .ts 文件 |
| Vue 3 + Vite + Vant 4 | ✅ | `package.json`, `vite.config.ts` |
| MySQL 8.0 (mysql2 raw SQL) | ✅ | `db/mysql.ts`, `db/dao.ts` |
| Redis 7 (ioredis) | ✅ | `db/redis.ts` |
| Zod 校验 | ✅ | `schemas.ts` + index.ts 路由层接入 |
| dayjs + Asia/Shanghai | ✅ | engine.ts / notify.ts / stats.ts |
| Vitest 测试 | ✅ | 5 个 test 文件, 58 用例 |

### §3 数据模型（10 张表）

| 表 | DDL | DAO | 对应功能 |
|----|-----|-----|----------|
| elder | ✅ | ElderDao | 老人主表 CRUD + 分页筛选 |
| emergency_contact | ✅ | EmergencyContactDao | 紧急联系人 |
| elder_status | ✅ | ElderStatusDao | 外出/住院/暂停状态管理 |
| device | ✅ | DeviceDao | 设备绑定 CRUD + 电量/在线更新 |
| sensor_event | ✅ | SensorEventDao | 传感器事件落库 |
| alert | ✅ | AlertDao | 告警 CRUD + 时间线 + 误报日志 |
| alert_timeline | ✅ | AlertDao.addTimeline | 告警处理流水 |
| false_positive_log | ✅ | AlertDao.addFalsePositiveLog | 误报反馈记录 |
| meal_check | ✅ | MealDao | 食堂签到/消费 |
| social_worker | ✅ | WorkerDao | 工作人员管理 |

### §4 规则引擎

| 要求 | 实现状态 | 对应文件 |
|------|----------|----------|
| 12 条规则全部实现 | ✅ | `rules/engine.ts` (12 个 eval 函数) |
| R-BTN 永不抑制/不去重 | ✅ | `rules.json` penetrateSuppress + skipDedup |
| 冷启动 7 天 60min | ✅ | evalBath01 中 installDays < 7 判断 |
| 事件摄入 + Redis state | ✅ | ingestEvent → LPUSH + HSET |
| R-BED-03 窗口聚合 | ✅ | computeBedAccum（22:00-06:00 累计在床） |
| 状态抑制守卫 | ✅ | `rules/status-guard.ts` |
| 5min 去重 | ✅ | `rules/dedup.ts` |

### §5 API 契约

| API | 实现状态 | 对应 handler |
|-----|----------|-------------|
| GET /alerts | ✅ | alert.ts → listAlerts |
| GET /alerts/:id | ✅ | alert.ts → getAlertDetail |
| PUT /alerts/:id/handle | ✅ | alert.ts → handleAlert (Zod 校验) |
| GET /elders | ✅ | elder.ts → listElders |
| GET /elders/:id | ✅ | elder.ts → getElderDetail |
| POST /elders/import | ✅ | elder.ts → importElders (Zod 校验) |
| PUT /elders/:id/status | ✅ | elder.ts → setElderStatus (Zod 校验) |
| POST /webhook/tuya | ✅ | webhook.ts → handleTuyaWebhook (签名验证 + Zod) |
| POST /webhook/dingtalk | ✅ | webhook.ts → handleDingtalkWebhook |
| POST /internal/mock-alert | ✅ | internal.ts → mockAlert |
| GET /me/stats | ✅ | stats.ts → getMyStats |
| POST /meals/checkin | ✅ | meal.ts → checkinMeal (Zod 校验) |
| POST /meals/import | ✅ | meal.ts → importMeals (Zod 校验) |

### §6 RBAC 权限矩阵

| 规则 | 实现状态 | 实现方式 |
|------|----------|----------|
| property 仅看 P0 | ✅ | index.ts GET /alerts 强制 level='P0' |
| building_manager 本楼 | ✅ | index.ts 强制 building 参数 |
| 楼长脱敏 | ✅ | rbac.ts sanitizeForBuildingManager |
| 路由角色限制 | ✅ | addRoute 的 roles 参数 + 403 拦截 |

### §7 钉钉集成

| 要求 | 实现状态 | 对应文件 |
|------|----------|----------|
| 群机器人 Webhook | ✅ | services/notify.ts |
| 互动卡片推送 | ✅ | services/dingtalk.ts → sendInteractiveCard |
| 语音双呼 (VOICE_MOCK) | ✅ | services/dingtalk.ts → initiateVoiceCall |
| 双呼升级 3 轮 | ✅ | services/escalation.ts |
| P1 夜间勿扰 23-06 | ✅ | services/notify.ts 中 quiet hours 判断 |
| 卡片回调处理 | ✅ | handlers/webhook.ts → handleDingtalkWebhook |
| JSAPI 免登 | ✅ | xidong-h5/utils/dingtalk.ts |

### §10 降级开关

| 开关 | 实现状态 | 对应逻辑 |
|------|----------|----------|
| VOICE_MOCK=true | ✅ | dingtalk.ts 中仅打日志 |
| TUYA_MOCK=true | ✅ | services/tuya.ts 不连 Pulsar |
| BASELINE_FIXED=true | ✅ | engine.ts 中 T_sleep 固定 22:00 |

---

## 五、尚未完成 / 待运行时验证的项目

| # | 项目 | 性质 | 说明 |
|---|------|------|------|
| 1 | 真实 MySQL/Redis 连接验证 | 运行时 | 需本地启动 docker-compose 后验证 |
| 2 | 涂鸦 Pulsar 真实连接 | 硬件依赖 | services/tuya.ts 为 stub，待设备到位后接入 SDK |
| 3 | 钉钉应用配置 | 外部服务 | 需填入 APP_KEY/SECRET/AGENT_ID 后验证 |
| 4 | JWT 鉴权替换 | W2 规划 | 当前用 header X-User-Id/X-Role，注释标注升级路径 |
| 5 | 前端测试 | 低优 | Spec 提到 Vitest 前端测试但 MVP 阶段未强制要求 |
| 6 | alert.service.ts / elder.service.ts 独立 | 架构优化 | 逻辑在 handler 中，代码量可控，不影响功能 |

---

## 六、编译 & 测试状态

```
# 后端
$ cd xidong-api && npx tsc --noEmit      → ✅ 无错误
$ cd xidong-api && npx vitest run         → ✅ 5 files, 58 tests passed (437ms)

# 前端  
$ cd xidong-h5 && npx vue-tsc --noEmit   → ✅ 无错误
$ cd xidong-h5 && npx vite build          → ✅ built in 141ms
```

---

## 七、代码行数统计

| 模块 | 文件数 | 总行数 |
|------|--------|--------|
| xidong-api/src | 22 | ~4,100 |
| xidong-api/tests | 5 | ~1,050 |
| xidong-api/scripts | 3 | ~410 |
| xidong-h5/src | 26 | ~3,400 |
| **合计** | **56** | **~9,000** |
