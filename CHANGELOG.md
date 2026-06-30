# 溪东社区智慧养老 — 变更记录（第一版本之后）

> 基线版本: `fbb0210` feat: 溪东社区智慧养老 MVP 全量代码 (Phase 0-1, W1-W4)

---

## 1. fix: 告警工单流转修复
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

## 2. feat: 角色登录系统 + 数据管理后台 + 操作审计
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

## 3. feat(h5): 适老化设计 — 大字模式 + 语音播报
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

## 4. docs: 文档整理
**提交**: cce841c, e8e94e8 | **日期**: 2026-06-26

- 添加根目录 README（项目总览）
- 更新 xidong-api / xidong-h5 子项目 README
- 将代码说明书整合进根 README

---

## 统计

| 指标 | 数值 |
|------|------|
| 总提交数 | 6 |
| 新增文件 | 5 |
| 修改文件 | 28 |
| 代码新增行 | ~1,200+ |
| 时间跨度 | 2026-06-26 ~ 2026-06-30 |
