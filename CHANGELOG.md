# 溪东社区智慧养老 — 变更记录（第一版本之后）

> 基线版本: `fbb0210` feat: 溪东社区智慧养老 MVP 全量代码 (Phase 0-1, W1-W4)

---

## 3. perf: P0+P1+P2 全面优化
**提交**: `d6134c3` | **日期**: 2026-07-01

### P0 — 安全与性能
- 修复 alert/meal/elder 列表 N+1 查询（21次→2次 DB 调用）
- CORS 白名单 + 环境感知配置
- 内部 API Token 防护（`INTERNAL_API_TOKEN`）
- 钉钉 Webhook HmacSHA256 签名验证

### P1 — 代码质量
- 提取 `useAlertMaps` composable，消除 6 处重复映射
- 新增数据库复合索引（`002_indexes.sql`）
- 统一错误响应工具（`AppError`）

### P2 — 可维护性与体验
- 新增 `utils/constants.ts` 集中管理前端业务常量
- 7 个视图补充 `showToast` 错误提示
- `AlertCard.vue` 使用 composable 精简 36 行
- 后端 `listElders` N+1 修复（批量 `findByElderIds`）
- 后端魔法值配置化（`QUIET_HOURS` / `ESCALATION_*`）
- API 响应类型增强（`PaginatedResponse<T>` 泛型）
- 消除 12 处 `as unknown as` 类型断言

### 涉及文件（26 files, +758 −307）
| 模块 | 关键文件 |
|------|----------|
| xidong-api | `src/index.ts`, `src/handlers/{alert,meal,elder,webhook}.ts`, `src/db/dao.ts`, `src/services/{notify,escalation}.ts`, `src/utils/api-response.ts`, `migrations/002_indexes.sql` |
| xidong-h5 | `src/api/index.ts`, `src/utils/constants.ts`, `src/composables/useAlertMaps.ts`, `src/components/AlertCard.vue`, `src/views/{Admin,AlertDetail,ElderDetail,ElderList,FpStats,Me,MealCheck,Workbench,building/BuildingAlerts}.vue` |

### 新增环境变量
`CORS_ORIGINS`, `INTERNAL_API_TOKEN`, `QUIET_HOURS`, `ESCALATION_TIMEOUT_SEC`, `ESCALATION_MAX_ROUNDS`

---

## 1. feat: 老人负责人关联功能
**提交**: pending | **日期**: 2026-06-30

### 功能变更
- **多对多关联表** `elder_assignment`：支持每位老人分配多个负责人（社工/楼长/备班）
- **4 个新 API**：查询负责人、分配、移除、我负责的老人
- **老人列表页改造**：非主任角色显示“我负责的老人”，主任看全部；每条显示负责人标签
- **老人详情页**：新增“负责人”区块，社工/主任可分配和移除负责人
- **权限控制**：仅社工和主任可操作分配/移除

### 代码变更
| 文件 | 变更 |
|------|------|
| `xidong-api/src/db/dao.ts` | 新增 ElderAssignmentDao (findByElder, findByWorker, assign, remove) |
| `xidong-api/src/index.ts` | 新增 4 个负责人 API 路由 |
| `xidong-api/src/handlers/elder.ts` | listElders/getElderDetail 返回 assignments 字段 |
| `xidong-h5/src/api/index.ts` | 新增 assignmentApi + Elder 接口扩展 |
| `xidong-h5/src/views/ElderList.vue` | 角色分流 + 负责人标签展示 |
| `xidong-h5/src/views/ElderDetail.vue` | 负责人区块 + 分配/移除管理弹窗 |

---

## 2. fix: 告警工单流转修复
**提交**: ffb6e08 | **日期**: 2026-06-30

### 功能变更
- 修复告警处理后工作台列表不刷新的问题（根因：Vite 未配置 API proxy，全部走 mock 静态数据）
- 工作台过滤逻辑修正：只有 `pending` 状态的告警显示在"紧急/注意" Tab，其余归入"已处理"
- 告警详情页处理后立即更新本地状态标签，让用户看到状态变化
- 处理完成 1.2s 后自动跳回工作台（replace 导航确保组件重建）
- App.vue router-view 添加 `:key` 确保路由切换时组件重建

### 代码变更
| 文件 | 变更 |
|------|------|
| `xidong-h5/vite.config.ts` | 添加 `/api` → `localhost:7071` 代理 |
| `xidong-h5/src/views/Workbench.vue` | 过滤条件改为 `status === 'pending'` |
| `xidong-h5/src/views/AlertDetail.vue` | 处理后更新本地状态 + `router.replace('/workbench')` |
| `xidong-h5/src/App.vue` | `<router-view :key="$route.fullPath" />` |
| `xidong-api/src/db/dao.ts` | AlertDao.create 修复 MySQL DATETIME 格式 |
| `xidong-api/src/handlers/alert.ts` | handleAlert 时间格式去除 T/Z |

---

## 3. feat: 角色登录系统 + 数据管理后台 + 操作审计
**提交**: 6416807 | **日期**: 2026-06-30

### 功能变更
- **角色选择登录页** (Login.vue)：5 个预设演示账号（社工/主任/楼长/备班/物业）
- **路由守卫**：未登录跳转登录页 + 角色权限拦截（数据管理仅主任/社工可进）
- **数据管理后台** (Admin.vue)：双 Tab 管理中心（老人管理 + 人员管理），支持搜索、新增、编辑、删除
- **"我的"页面入口**：数据管理入口仅主任/社工可见
- **操作审计**：elder 表新增 `created_by` / `updated_by` 字段，自动记录操作人
- **phpMyAdmin**：Docker 新增 phpMyAdmin 服务（端口 8080），可直接操作数据库
- **路由正则修复**：`:param` 匹配正则从 `(w+)` 改为 `([a-zA-Z_]+)`
- **MySQL2 参数修复**：4 处 LIMIT/OFFSET 参数转为 String()
- **Mock fallback**：前端 API 层添加后端不可用时的 mock 数据兜底

### 代码变更
| 文件 | 变更 |
|------|------|
| `xidong-h5/src/views/Login.vue` | 新建 — 角色选择登录页 |
| `xidong-h5/src/views/Admin.vue` | 重写 — 双 Tab CRUD 管理中心 |
| `xidong-h5/src/views/Me.vue` | 添加数据管理入口 + 退出登录跳 /login |
| `xidong-h5/src/router/index.ts` | /login 路由 + 路由守卫 |
| `xidong-h5/src/stores/user.ts` | 去掉自动 mock 登录 |
| `xidong-h5/src/api/index.ts` | 添加 elderApiExt.create + mock fallback |
| `xidong-h5/src/api/mock-data.ts` | 新建 — 演示数据集 |
| `xidong-api/src/index.ts` | POST /api/elders + 路由正则修复 + created_by |
| `xidong-api/src/db/dao.ts` | LIMIT 参数修复 + create/update 支持审计字段 |
| `xidong-api/src/handlers/elder.ts` | updateElder 传入 operatorName |
| `xidong-api/docker-compose.yml` | 添加 phpMyAdmin 服务 |

---

## 4. feat(h5): 适老化设计 — 大字模式 + 语音播报
**提交**: 79bfd83 | **日期**: 2026-06-29

### 功能变更
- **大字模式**：CSS 变量驱动，全局字号放大，按钮/间距同步增大
- **语音播报**：告警卡片支持 Web Speech API 朗读，点击喇叭图标播报告警内容
- **"我的"页面**：适老模式开关（大字号 + 语音播报），状态持久化到 localStorage

### 代码变更
| 文件 | 变更 |
|------|------|
| `xidong-h5/src/utils/accessibility.ts` | 新建 — 适老模式工具函数 |
| `xidong-h5/src/styles/theme.css` | 添加大字模式 CSS 变量 |
| `xidong-h5/src/components/AlertCard.vue` | 添加语音播报按钮 |
| `xidong-h5/src/views/Me.vue` | 适老模式开关 |
| `xidong-h5/src/App.vue` | 启动时恢复适老模式状态 |

---

## 5. docs: 文档整理
**提交**: cce841c, e8e94e8 | **日期**: 2026-06-26

- 添加根目录 README（项目总览）
- 更新 xidong-api / xidong-h5 子项目 README
- 将代码说明书整合进根 README

---

## 8. refactor: P0+P1 代码优化（性能/安全/DRY）
**提交**: pending | **日期**: 2026-07-01

### P0 安全与性能修复
- **N+1 查询修复**：alert/meal 列表批量查询老人信息，20条从 21次DB → 2次
- **CORS 白名单**：生产环境仅允许 `CORS_ORIGINS` 白名单域名
- **内部 API 防护**：生产环境禁用 /api/internal/*；开发环境支持 Token 验证
- **钉钉签名验证**：实现 HmacSHA256 回调签名 + 时间戳过期检查

### P1 代码质量优化
- **前端 DRY**：提取 `composables/useAlertMaps.ts` 消除 5+ 组件中重复的状态/等级映射
- **数据库索引**：新增 7 个复合索引优化工作台和统计查询
- **统一错误格式**：创建 `utils/api-response.ts` 标准化 API 错误响应
- **路由注册器**：创建 `routes/registry.ts` 为路由模块化打基础

### 代码变更
| 文件 | 变更 |
|------|------|
| `xidong-api/src/handlers/alert.ts` | 修复 N+1，批量 findByIds + Map |
| `xidong-api/src/handlers/meal.ts` | 修复 N+1，同上 |
| `xidong-api/src/db/dao.ts` | 新增 ElderDao.findByIds |
| `xidong-api/src/index.ts` | CORS 白名单 + 内部 API Token 防护 |
| `xidong-api/src/handlers/webhook.ts` | 实现钉钉签名验证 |
| `xidong-api/.env.example` | 新增 CORS_ORIGINS、INTERNAL_API_TOKEN |
| `xidong-api/migrations/002_indexes.sql` | 新增 7 个性能索引 |
| `xidong-api/src/utils/api-response.ts` | 统一错误响应工具 |
| `xidong-api/src/routes/registry.ts` | 路由注册器（模块化基础） |
| `xidong-h5/src/composables/useAlertMaps.ts` | 状态/等级映射统一函数 |
| `xidong-h5/src/views/AlertDetail.vue` | 改用 composable |
| `xidong-h5/src/views/ElderDetail.vue` | 改用 composable |
| `xidong-h5/src/views/building/BuildingAlerts.vue` | 改用 composable |

---

## 统计

| 指标 | 数值 |
|------|------|
| 总提交数 | 8 |
| 新增文件 | 9 |
| 修改文件 | 41 |
| 代码新增行 | ~1,800+ |
| 时间跨度 | 2026-06-26 ~ 2026-07-01 |
