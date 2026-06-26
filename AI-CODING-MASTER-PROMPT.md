# 溪东社区智慧养老 MVP — AI Coding Master Prompt

> **版本**：v2.0 | **日期**：2026-06-25  
> **用途**：喂给 AI 编程工具（Cursor/Copilot/Qoder）的项目级系统提示  
> **覆盖**：Phase 0-1（W1–W4），TypeScript + Vue3 全栈

---

## 0. 项目一句话

溪东社区智慧养老 MVP：让 15 名社工通过无感传感器 + 智能融合规则 + 钉钉协同，把独居老人异常事件响应时间从「两天后发现」缩短到「30 分钟内响应」。

---

## 1. 技术栈约定

| 层 | 选型 | 版本 |
|----|------|------|
| 后端 | 阿里云 FC 3.0 + **TypeScript** | Node 18 + TS 5.x |
| 前端 | Vue 3 + Vite + Vant 4 + TypeScript | Vue 3.4+ |
| 数据库 | MySQL 8.0（RDS 基础版） | 8.0 |
| 缓存 | Redis 7 社区版 | 7.x |
| 设备接入 | 涂鸦 IoT Pulsar | — |
| 通知 | 钉钉企业内部应用（卡片+语音+免登） | — |
| 测试 | Vitest（后端）+ Vitest（前端） | — |
| 校验 | Zod | 3.x |
| 时间 | dayjs + Asia/Shanghai | — |
| ORM | mysql2（raw SQL，不用 ORM） | — |

**禁止**：不使用 Sequelize/TypeORM/Prisma；不使用 Express（FC HTTP 触发器原生）；不做 Flutter App。

---

## 2. 代码仓库与目录结构

### 2.1 xidong-api（后端）

```
xidong-api/
├── package.json
├── tsconfig.json
├── docker-compose.yml
├── .env.example
├── migrations/
│   └── 001_mvp.sql
├── src/
│   ├── index.ts              # FC HTTP handler 入口
│   ├── types/
│   │   └── index.ts          # 全局类型定义
│   ├── handlers/
│   │   ├── alert.ts          # GET/PUT /alerts
│   │   ├── elder.ts          # GET/POST/PUT /elders
│   │   ├── webhook.ts        # POST /webhook/tuya, /webhook/dingtalk
│   │   ├── internal.ts       # POST /internal/mock-alert
│   │   └── stats.ts          # GET /me/stats
│   ├── rules/
│   │   ├── rules.json        # 规则配置
│   │   ├── engine.ts         # 规则评估核心
│   │   ├── status-guard.ts   # 状态抑制守卫
│   │   └── dedup.ts          # 去重服务
│   ├── services/
│   │   ├── alert.service.ts
│   │   ├── elder.service.ts
│   │   ├── notify.service.ts # 通知调度器
│   │   ├── dingtalk.ts       # 钉钉 API 封装
│   │   └── tuya.ts           # 涂鸦 Pulsar 消费
│   ├── db/
│   │   ├── mysql.ts          # 连接池
│   │   └── redis.ts          # Redis 客户端
│   └── middleware/
│       └── rbac.ts           # RBAC 中间件
├── tests/
│   ├── rules/
│   │   └── engine.test.ts
│   ├── handlers/
│   │   └── alert.test.ts
│   └── services/
│       └── notify.test.ts
└── scripts/
    └── simulate-day.ts       # 模拟一位老人 24h 事件
```

### 2.2 xidong-h5（前端）

```
xidong-h5/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html
├── src/
│   ├── main.ts
│   ├── App.vue
│   ├── router/
│   │   └── index.ts
│   ├── api/
│   │   └── index.ts          # axios 封装 + 接口定义
│   ├── stores/
│   │   └── user.ts           # Pinia 用户状态
│   ├── views/
│   │   ├── Workbench.vue     # 告警工作台（三Tab）
│   │   ├── AlertDetail.vue   # 告警详情+关单
│   │   ├── ElderList.vue     # 老人档案列表
│   │   ├── ElderDetail.vue   # 老人详情
│   │   ├── Me.vue            # 个人中心
│   │   └── building/
│   │       └── BuildingAlerts.vue  # 楼长视图
│   ├── components/
│   │   ├── AlertCard.vue
│   │   ├── Timeline.vue
│   │   └── StatusModal.vue
│   ├── utils/
│   │   └── dingtalk.ts       # JSAPI 免登
│   └── styles/
│       └── theme.css         # Vant 主题覆盖
└── .env.example
```

---

## 3. 数据模型（MySQL 10 张表）

```sql
-- ==================== MVP DDL ====================

-- 1. 老人主表
CREATE TABLE elder (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  gender ENUM('男','女') NOT NULL DEFAULT '男',
  age INT,
  grid_id BIGINT,
  community VARCHAR(100),
  building VARCHAR(20) NOT NULL COMMENT '楼长隔离键',
  unit VARCHAR(20),
  room VARCHAR(20),
  phone VARCHAR(20) COMMENT 'AES加密',
  id_card VARCHAR(64) COMMENT 'AES加密',
  chronic_disease TEXT COMMENT '楼长不可见',
  risk_class ENUM('A','B','C') NOT NULL DEFAULT 'C',
  plan_level ENUM('full','standard','basic') NOT NULL DEFAULT 'basic',
  habit_profile JSON COMMENT '见下方说明',
  is_homebound TINYINT NOT NULL DEFAULT 0 COMMENT '长期居家关闭R-DOOR-01',
  property_phone VARCHAR(20) COMMENT '对应物业24h值班',
  notes TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_building (building),
  INDEX idx_risk_class (risk_class)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- habit_profile JSON 结构:
-- {"t_sleep":"22:00","delta_min":90,"bed_leave_min":30,"bath_threshold_min":30,"install_days":0,"baseline_ready":false}

-- 2. 紧急联系人
CREATE TABLE emergency_contact (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  elder_id BIGINT NOT NULL,
  name VARCHAR(50) NOT NULL,
  relation VARCHAR(20),
  phone VARCHAR(20) NOT NULL,
  priority INT NOT NULL DEFAULT 1,
  FOREIGN KEY (elder_id) REFERENCES elder(id),
  INDEX idx_elder (elder_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. 老人状态管理
CREATE TABLE elder_status (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  elder_id BIGINT NOT NULL,
  status ENUM('home','away','hospital','paused') NOT NULL,
  start_at DATETIME NOT NULL,
  end_at DATETIME,
  note TEXT,
  created_by BIGINT,
  ended_early TINYINT DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (elder_id) REFERENCES elder(id),
  INDEX idx_elder_active (elder_id, end_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. 设备绑定
CREATE TABLE device (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  elder_id BIGINT NOT NULL,
  tuya_device_id VARCHAR(64) NOT NULL UNIQUE,
  device_type ENUM('button','bed','pir','door') NOT NULL,
  location VARCHAR(50) NOT NULL COMMENT '床头/卫生间/床垫下/入户门',
  battery_pct INT DEFAULT 100,
  last_event_at DATETIME,
  online TINYINT DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (elder_id) REFERENCES elder(id),
  INDEX idx_tuya_device (tuya_device_id),
  INDEX idx_elder (elder_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. 传感器事件（按月分区）
CREATE TABLE sensor_event (
  id BIGINT AUTO_INCREMENT,
  elder_id BIGINT NOT NULL,
  device_id BIGINT NOT NULL,
  event_type VARCHAR(32) NOT NULL,
  payload JSON,
  event_time DATETIME(3) NOT NULL,
  PRIMARY KEY (id, event_time),
  INDEX idx_elder_time (elder_id, event_time),
  INDEX idx_device_time (device_id, event_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
PARTITION BY RANGE (TO_DAYS(event_time)) (
  PARTITION p202606 VALUES LESS THAN (TO_DAYS('2026-07-01')),
  PARTITION p202607 VALUES LESS THAN (TO_DAYS('2026-08-01')),
  PARTITION p202608 VALUES LESS THAN (TO_DAYS('2026-09-01')),
  PARTITION p_future VALUES LESS THAN MAXVALUE
);

-- 6. 告警
CREATE TABLE alert (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  elder_id BIGINT NOT NULL,
  rule_id VARCHAR(32) NOT NULL COMMENT 'R-BTN/R-MIX-01等',
  level ENUM('P0','P1','P2') NOT NULL,
  status ENUM('pending','processing','dispatched','closed','closed_false_positive') NOT NULL DEFAULT 'pending',
  trigger_desc TEXT NOT NULL,
  context_json JSON,
  handler_id BIGINT,
  handler_note TEXT,
  false_positive_reason VARCHAR(32),
  triggered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  handled_at DATETIME,
  closed_at DATETIME,
  FOREIGN KEY (elder_id) REFERENCES elder(id),
  INDEX idx_status_level (status, level),
  INDEX idx_elder (elder_id),
  INDEX idx_triggered (triggered_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. 告警流水
CREATE TABLE alert_timeline (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  alert_id BIGINT NOT NULL,
  event_type ENUM('triggered','pushed','acknowledged','suppressed','escalated','closed','dispatched') NOT NULL,
  channel VARCHAR(32),
  meta JSON,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (alert_id) REFERENCES alert(id),
  INDEX idx_alert (alert_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. 误报反馈
CREATE TABLE false_positive_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  alert_id BIGINT NOT NULL,
  elder_id BIGINT NOT NULL,
  rule_id VARCHAR(32) NOT NULL,
  reason ENUM('bathing','visitor','pet','device_fault','other') NOT NULL,
  social_worker_id BIGINT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (alert_id) REFERENCES alert(id),
  INDEX idx_elder_rule (elder_id, rule_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9. 食堂打卡
CREATE TABLE meal_check (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  elder_id BIGINT NOT NULL,
  meal_date DATE NOT NULL,
  meal_type ENUM('lunch','dinner') NOT NULL,
  checked_at DATETIME,
  FOREIGN KEY (elder_id) REFERENCES elder(id),
  UNIQUE KEY uk_elder_meal (elder_id, meal_date, meal_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 10. 工作人员
CREATE TABLE social_worker (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  dingtalk_user_id VARCHAR(64) UNIQUE,
  role ENUM('social_worker','backup','building_manager','director','property') NOT NULL,
  building VARCHAR(20) COMMENT '楼长专用',
  phone VARCHAR(20),
  on_duty TINYINT DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### Redis Key 设计

| Key 模式 | 类型 | TTL | 用途 |
|----------|------|-----|------|
| `evt:{elderId}` | List (LPUSH) | 48h (LTRIM) | 传感器事件窗口 |
| `state:{elderId}` | Hash | — | 当前: in_bed/door_open/pir_active/status |
| `dedup:{elderId}:{level}:{ruleId}` | String | 5min | 告警去重 |
| `fp:{elderId}:{ruleId}` | String | 7d | 误报抑制 |
| `escalation:{alertId}` | Hash | 24h | 双呼升级轮次 |

---

## 4. 规则引擎（12 条规则，新编码）

### 4.1 规则注册表

| rule_id | 等级 | 方案要求 | 简述 | 关键条件 |
|---------|------|---------|------|---------|
| R-BTN | P0 | 全部 | 按键长按≥2s | penetrate=true, skipDedup=true |
| R-MIX-01 | P0 | full/standard | 夜间离床+厕所PIR有人 | 离床≥30min+PIR active |
| R-MIX-02 | P0 | full/standard | 应睡未睡+未出门+厕所无人 | T_sleep+Δ仍离床 |
| R-BED-01 | P1 | full/standard | 夜间离床超时 | 19:00-07:00,厕所无人 |
| R-BED-02 | P1 | full/standard | 应睡未睡 | T_sleep+Δ仍未上床 |
| R-BED-03 | P1 | full/standard | 整夜在床<1h | 22:00-06:00累计 |
| R-BED-04 | P1 | full/standard | 连续在床>12h | — |
| R-BATH-01 | P1 | full/standard | 卫生间滞留 | PIR≥threshold;冷启动7天 |
| R-DOOR-01 | P2 | full | 72h未出门 | homebound时关闭 |
| R-DOOR-02 | P2 | full | 门长开≥30min | — |
| R-DEV-01 | P2 | 全部 | 24h无事件 | 设备维护 |
| R-DEV-02 | P2 | 全部 | 电量<20% | 设备维护 |

### 4.2 TypeScript 核心接口

```typescript
// === 事件类型 ===
interface SensorEvent {
  elderId: string;
  deviceId: string;
  deviceType: 'button' | 'bed' | 'pir' | 'door';
  eventType: 'button_hold' | 'on_bed' | 'off_bed' | 'pir_active' | 'pir_clear' | 'door_open' | 'door_close';
  payload: Record<string, unknown>;  // { hold_sec, battery_pct, ... }
  ts: Date;  // Asia/Shanghai
}

// === 老人上下文 ===
interface ElderContext {
  id: string;
  name: string;
  building: string;
  planLevel: 'full' | 'standard' | 'basic';
  riskClass: 'A' | 'B' | 'C';
  status: 'home' | 'away' | 'hospital' | 'paused';
  statusWindow?: { start: Date; end: Date };
  isHomebound: boolean;
  propertyPhone: string;
  habitProfile: {
    tSleep: string;         // "22:00"
    deltaMin: number;       // 90
    bedLeaveMin: number;    // 30
    bathThresholdMin: number; // 30
    installDays: number;
    baselineReady: boolean;
  };
}

// === 规则输出 ===
interface AlertCandidate {
  ruleId: string;
  level: 'P0' | 'P1' | 'P2';
  elderId: string;
  reason: string;           // 人类可读
  context: Record<string, unknown>;
  suppressed?: boolean;
  suppressReason?: 'away' | 'hospital' | 'paused' | 'false_positive' | 'priority';
}

// === 引擎 API ===
function ingestEvent(event: SensorEvent): Promise<void>;
function evaluate(elderId: string, ctx: ElderContext): Promise<AlertCandidate[]>;
function applySuppression(candidates: AlertCandidate[], ctx: ElderContext): AlertCandidate[];
function applyDedup(candidates: AlertCandidate[], elderId: string): Promise<AlertCandidate[]>;
```

### 4.3 关键约束

- **R-BTN 永不抑制**：penetrateSuppress=true
- **R-BTN 不去重**：skipDedup=true
- **冷启动**：PIR 安装 7 天内仅 >60min 告警
- **新户 T_sleep**：固定 22:00+Δ90min，14天后切中位数
- **禁止**：4h 无心跳规则（改用 24h 无事件 R-DEV-01）

---

## 5. API 契约

**Base URL**：`https://{gateway}/api`  
**鉴权**：`Authorization: Bearer {jwt}`（JWT含userId,role,building?）  
**时区**：所有datetime为Asia/Shanghai ISO8601

### 5.1 告警 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /alerts | 分页,筛选level/status/elder_id |
| GET | /alerts/:id | 详情+48h时间线+为什么判异常 |
| PUT | /alerts/:id/handle | 处置action |

**状态机**：pending→processing→closed/closed_false_positive/dispatched→closed

### 5.2 档案 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /elders | 分页筛选 |
| GET | /elders/:id | 详情+设备+状态 |
| POST | /elders/import | Excel导入 |
| PUT | /elders/:id/status | 外出/住院/暂停 |

### 5.3 Webhook & 内部

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /webhook/tuya | 涂鸦事件 |
| POST | /webhook/dingtalk | 钉钉回调 |
| POST | /internal/mock-alert | dev mock |
| GET | /me/stats | 统计 |
| POST | /meal-checks/import | 食堂CSV |

---

## 6. RBAC 权限矩阵

| 资源 | social_worker | building_manager | property | director |
|------|:---:|:---:|:---:|:---:|
| 告警列表 | 全部 | 本building | 仅P0 | 全部 |
| 告警处置 | ✓ | dispatch回填 | 到场回填 | ✗ |
| 档案读 | 全部 | 本楼脱敏 | 当前告警 | 全部 |
| 档案写 | 阈值 | ✗ | ✗ | ✓ |

**楼长脱敏**：phone、chronic_disease、emergency_contact.phone → null

---

## 7. 钉钉集成

### 7.1 通知分级

| 等级 | 主通道 | 副通道 | 勿扰 |
|------|--------|--------|------|
| P0 | 语音双呼 | 卡片+H5弹窗振动 | 无 |
| P1 | 卡片强提醒 | H5红点 | 23:00-06:00不响铃 |
| P2 | 群普通消息 | H5消息中心 | 全天不强提醒 |

### 7.2 双呼升级
```
parallel_call([worker.phone, property.phone])
on_timeout(60s) → escalate(backup + supervisor)
round >= 3 → @all + director
fallback: DING + 卡片 + 短信
```

---

## 8. 编码规范

- 文件：kebab-case | 类/接口：PascalCase | 函数：camelCase
- Git: `feat(rules): implement R-BED-01`
- 测试：每规则≥3个单测；API handler≥3个测试
- 错误：400/403/409/500 统一格式 `{ error, details? }`

---

## 9. 环境变量

```env
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=xidong
MYSQL_PASSWORD=xidong_dev
MYSQL_DATABASE=xidong_elderly
REDIS_HOST=localhost
REDIS_PORT=6379
DINGTALK_APP_KEY=
DINGTALK_APP_SECRET=
DINGTALK_AGENT_ID=
DINGTALK_ROBOT_WEBHOOK=
TUYA_ACCESS_ID=
TUYA_ACCESS_SECRET=
NODE_ENV=development
VOICE_MOCK=true
BASELINE_FIXED=true
TUYA_MOCK=true
```

---

## 10. 降级开关

| 开关 | 效果 |
|------|------|
| `VOICE_MOCK=true` | 双呼只打日志 |
| `BASELINE_FIXED=true` | T_sleep固定22:00 |
| `TUYA_MOCK=true` | 不连Pulsar |
