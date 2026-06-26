# xidong-h5 — 前端 H5

Vue 3 + Vite + Vant 4，运行在钉钉内嵌浏览器中，面向社工的移动端工作台。

## 快速开始

```bash
npm install
npm run dev
# → http://localhost:5173
```

## 页面结构

| 路由 | 文件 | 说明 |
|------|------|------|
| / | Workbench.vue | 工作台首页（今日待办 + P0 告警） |
| /alerts/:id | AlertDetail.vue | 告警详情 + 处置按钮 |
| /elders | ElderList.vue | 老人档案列表 |
| /elders/:id | ElderDetail.vue | 档案详情 + 状态管理 |
| /building | BuildingAlerts.vue | 楼栋告警视图 |
| /meals | MealCheck.vue | 食堂签到 |
| /stats | FpStats.vue | 统计看板 |
| /admin | Admin.vue | 系统管理 |
| /me | Me.vue | 个人中心 |

## 技术栈

- Vue 3 + Composition API (`<script setup>`)
- Vite 6
- Vant 4（移动端组件库）
- Pinia（状态管理）
- vue-router 4
- TypeScript 5

## 构建

```bash
npm run build
# 输出到 dist/
```
