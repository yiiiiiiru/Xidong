# 溪东社区智慧养老 MVP — 部署与配置指南

> **适用阶段**：本地开发 → 阿里云 FC 部署  
> **前置条件**：macOS/Linux，已安装 Docker Desktop、Node.js 18+、npm

---

## 一、本地启动（5 分钟跑通）

### Step 1: 启动数据库

```bash
cd xidong-api
docker-compose up -d
```

这会启动：
- **MySQL 8.0** — localhost:3306（用户 `xidong` / 密码 `xidong_dev`）
- **Redis 7** — localhost:6379（无密码）

> 首次启动时 `migrations/001_mvp.sql` 会自动执行（挂载到 initdb.d）。

### Step 2: 安装依赖 & 配置环境

```bash
# 后端
cd xidong-api
npm install
cp .env.example .env
# .env 默认值可直接用于本地开发，无需修改

# 前端
cd ../xidong-h5
npm install
```

### Step 3: 灌入模拟数据（可选）

```bash
cd xidong-api
npx tsx scripts/seed-mock.ts
```

### Step 4: 启动开发服务器

```bash
# 终端1: 后端
cd xidong-api
npm run dev
# → http://localhost:7071/api/health

# 终端2: 前端
cd xidong-h5
npm run dev
# → http://localhost:5173
```

### Step 5: 验证

```bash
# 健康检查
curl http://localhost:7071/api/health

# 模拟一条告警
curl -X POST http://localhost:7071/api/internal/mock-alert \
  -H "Content-Type: application/json" \
  -H "X-User-Id: mock_sw_001" \
  -H "X-Role: social_worker" \
  -d '{"elder_id":"1","rule_id":"R-BTN","level":"P0"}'

# 查看告警列表
curl http://localhost:7071/api/alerts \
  -H "X-User-Id: mock_sw_001" \
  -H "X-Role: social_worker"
```

---

## 二、数据库管理

### 方案 A: 命令行连接

```bash
# 进入 MySQL 容器
docker exec -it xidong-mysql mysql -u xidong -pxidong_dev xidong_elderly

# 常用命令
SHOW TABLES;
SELECT * FROM elder LIMIT 10;
SELECT * FROM alert ORDER BY triggered_at DESC LIMIT 10;
DESC device;
```

### 方案 B: GUI 工具（推荐）

| 工具 | 平台 | 说明 |
|------|------|------|
| **Sequel Ace** | macOS（免费） | App Store 下载，轻量好用 |
| **TablePlus** | macOS/Win/Linux | 免费版够用 |
| **DBeaver** | 全平台（免费） | 功能最全 |
| **Navicat** | 全平台（付费） | 企业常用 |

**连接参数：**

```
Host:     localhost (或 127.0.0.1)
Port:     3306
User:     xidong
Password: xidong_dev
Database: xidong_elderly
```

### 方案 C: phpMyAdmin（Web 版）

如果偏好浏览器操作，在 `docker-compose.yml` 中加一个服务：

```yaml
  phpmyadmin:
    image: phpmyadmin:5
    container_name: xidong-phpmyadmin
    environment:
      PMA_HOST: mysql
      MYSQL_ROOT_PASSWORD: root123
    ports:
      - "8080:80"
    depends_on:
      - mysql
```

然后 `docker-compose up -d`，浏览器打开 http://localhost:8080，用 `root` / `root123` 或 `xidong` / `xidong_dev` 登录。

### Redis 管理

```bash
# 命令行
docker exec -it xidong-redis redis-cli

# 常用命令
KEYS *
HGETALL state:1       # 老人 ID=1 的实时状态
LRANGE evt:1 0 9      # 最近 10 条事件
```

GUI 工具推荐：**Another Redis Desktop Manager**（免费，全平台）或 **RedisInsight**。

---

## 三、钉钉应用配置

### 3.1 创建企业内部应用

1. 打开 [钉钉开放平台](https://open-dev.dingtalk.com/)
2. 登录管理员账号 → 「应用开发」→「企业内部开发」→「创建应用」
3. 填写：
   - 应用名称：`溪东智慧养老`
   - 应用描述：`社区独居老人异常监测与告警响应系统`
4. 创建成功后进入应用详情页

### 3.2 获取凭证

在应用详情页 →「凭证与基础信息」：

| 字段 | 对应 .env 变量 |
|------|----------------|
| AppKey | `DINGTALK_APP_KEY` |
| AppSecret | `DINGTALK_APP_SECRET` |
| AgentId | `DINGTALK_AGENT_ID` |

### 3.3 配置群机器人

1. 进入钉钉工作群 → 群设置 → 智能群助手 → 添加机器人
2. 选「自定义」→ 安全设置选「加签」
3. 记录：
   - Webhook 地址 → `DINGTALK_ROBOT_WEBHOOK`（即 `DINGTALK_WEBHOOK`）
   - 签名密钥 → `DINGTALK_ROBOT_SECRET`（即 `DINGTALK_SECRET`）

### 3.4 配置应用功能

#### H5 微应用（免登）

1. 应用详情 →「应用功能」→「网页应用」
2. 填写：
   - 应用首页：`https://你的域名/`（开发阶段填内网穿透地址）
   - 服务器出口IP：你的服务器公网 IP
3.「权限管理」→ 申请以下权限：
   - `通讯录个人信息读权限`
   - `企业员工手机号信息`
   - `智能人事花名册`

#### 互动卡片

1. 应用详情 →「互动卡片」→ 开通
2. 创建卡片模板（告警通知卡片）：
   - 模板名：`alert_notify`
   - 按钮：`确认处理` / `标记安全` / `误报`
3. 记录卡片模板 ID，在 `services/dingtalk.ts` 中使用

#### 事件订阅（卡片回调）

1. 应用详情 →「事件与回调」→ 配置回调地址
2. 回调 URL：`https://你的域名/api/webhook/dingtalk`
3. 勾选事件：`互动卡片回调事件`

### 3.5 语音通知（双呼）

1. 应用详情 →「应用功能」→ 开通「智能电话」
2. 需要企业已开通钉钉电话功能
3. 开发阶段设 `VOICE_MOCK=true`，仅打日志不真呼

### 3.6 最终 .env 配置示例

```env
DINGTALK_APP_KEY=ding1234567890abcdef
DINGTALK_APP_SECRET=AbCdEfGhIjKlMnOpQrStUvWxYz1234567890
DINGTALK_AGENT_ID=123456789
DINGTALK_ROBOT_WEBHOOK=https://oapi.dingtalk.com/robot/send?access_token=xxxxx
DINGTALK_ROBOT_SECRET=SEC1234567890abcdef
VOICE_MOCK=true
```

---

## 四、涂鸦 IoT 配置（硬件到位后）

### 4.1 创建云开发项目

1. 登录 [涂鸦 IoT 开发平台](https://iot.tuya.com/)
2. 创建云开发项目 → 获取：
   - Access ID → `TUYA_ACCESS_ID`
   - Access Secret → `TUYA_ACCESS_SECRET`
3. 关联设备产品（床垫传感器、PIR、门磁、按钮）

### 4.2 配置消息订阅

- 方式一（当前）：HTTP Webhook → `POST /api/webhook/tuya`
- 方式二（后续）：Pulsar 消息队列 → `services/tuya.ts` 中接入 SDK

### 4.3 设备映射

开发阶段用 Redis 映射：

```bash
# 通过内部 API 注册设备映射
curl -X POST http://localhost:7071/api/internal/seed-devices \
  -H "Content-Type: application/json" \
  -d '{
    "devices": [
      {"devId": "tuya_bed_001", "elderId": "1", "deviceType": "bed", "location": "床垫下"},
      {"devId": "tuya_pir_001", "elderId": "1", "deviceType": "pir", "location": "卫生间"},
      {"devId": "tuya_door_001", "elderId": "1", "deviceType": "door", "location": "入户门"},
      {"devId": "tuya_btn_001", "elderId": "1", "deviceType": "button", "location": "床头"}
    ]
  }'
```

---

## 五、后续待办事项（按优先级）

### 阶段 1: 本地联调（1-2 天）

| # | 任务 | 说明 |
|---|------|------|
| 1 | docker-compose up + seed 跑通 | 验证全链路：事件→规则→告警→通知 |
| 2 | 前端联调后端 | 配置 vite.config.ts proxy 到 7071 |
| 3 | 钉钉群机器人联调 | 填入 webhook + secret，发一条真实通知 |

### 阶段 2: 钉钉集成（2-3 天）

| # | 任务 | 说明 |
|---|------|------|
| 4 | 创建钉钉应用 + 免登联调 | 内网穿透 + H5 免登获取 userId |
| 5 | 互动卡片模板创建 | 在钉钉后台配置告警卡片 |
| 6 | 回调地址验证 | 确保 /webhook/dingtalk 可被钉钉访问 |
| 7 | JWT 替换 header auth | 钉钉免登成功后签发 JWT |

### 阶段 3: 设备接入（硬件到位后）

| # | 任务 | 说明 |
|---|------|------|
| 8 | 涂鸦平台配置 | 创建项目+绑定设备 |
| 9 | 设备映射录入 | device 表 + Redis 映射 |
| 10 | Webhook 联调 | 真实设备事件 → 规则触发验证 |
| 11 | 基线学习 | 14 天后切 T_sleep 中位数 |

### 阶段 4: 部署上线

| # | 任务 | 说明 |
|---|------|------|
| 12 | 阿里云 RDS + Redis 创建 | 生产环境数据库 |
| 13 | 阿里云 FC 部署 | 配置触发器 + 环境变量 |
| 14 | 域名 + HTTPS | 绑定域名，钉钉要求 HTTPS |
| 15 | VOICE_MOCK=false | 开启真实双呼 |
| 16 | TUYA_MOCK=false | 开启 Pulsar 消费 |

---

## 六、常见问题

### Q: docker-compose up 后 MySQL 连不上？

```bash
# 检查容器状态
docker ps
# 如果 xidong-mysql 状态是 restarting，查看日志
docker logs xidong-mysql
# 常见原因：端口 3306 被占用
lsof -i :3306
```

### Q: 前端请求 API 报 CORS？

开发时后端已处理 CORS（index.ts 中 Access-Control-Allow-Origin: *）。
如果仍有问题，在 `xidong-h5/vite.config.ts` 中加代理：

```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:7071',
      changeOrigin: true,
    },
  },
}
```

### Q: 如何重置数据库？

```bash
docker-compose down -v  # 删除数据卷
docker-compose up -d    # 重新初始化
npx tsx scripts/seed-mock.ts  # 重新灌入模拟数据
```

### Q: 钉钉回调怎么在本地调试？

使用内网穿透工具（推荐 [ngrok](https://ngrok.com/) 或 [cpolar](https://www.cpolar.com/)）：

```bash
ngrok http 7071
# 得到公网地址如 https://abc123.ngrok.io
# 将 https://abc123.ngrok.io/api/webhook/dingtalk 填入钉钉回调配置
```

### Q: 如何模拟完整的一天事件流？

```bash
cd xidong-api
npx tsx scripts/simulate-day.ts
# 会模拟一位老人 24h 的传感器事件，触发各种规则
```
