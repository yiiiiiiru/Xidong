/**
 * 前端 Mock 数据 — 后端不可用时自动展示演示数据
 * ponytail: 纯前端 fallback，不影响正式逻辑；升级路径：MSW
 */

import type { Alert, Elder, MealRecord } from './index'

const now = new Date().toISOString()
const hourAgo = new Date(Date.now() - 3600_000).toISOString()
const dayAgo = new Date(Date.now() - 86400_000).toISOString()

export const mockAlerts: Alert[] = [
  {
    id: '1', elder_id: '1', elder_name: '张大爷', building: '3',
    rule_id: 'R-BTN', level: 'P0', status: 'pending',
    trigger_desc: '一键报警按钮被按下，请立即确认安全', triggered_at: now,
  },
  {
    id: '2', elder_id: '2', elder_name: '李奶奶', building: '5',
    rule_id: 'R-MIX-01', level: 'P0', status: 'processing',
    trigger_desc: '夜间离床超30分钟，卫生间PIR检测到人体存在', triggered_at: hourAgo,
  },
  {
    id: '3', elder_id: '3', elder_name: '王伯伯', building: '3',
    rule_id: 'R-BED-01', level: 'P1', status: 'pending',
    trigger_desc: '夜间离床已超过45分钟，卫生间无人', triggered_at: hourAgo,
  },
  {
    id: '4', elder_id: '4', elder_name: '赵阿姨', building: '7',
    rule_id: 'R-BATH-01', level: 'P1', status: 'processing',
    trigger_desc: '卫生间滞留已超过60分钟', triggered_at: hourAgo,
  },
  {
    id: '5', elder_id: '5', elder_name: '刘大爷', building: '2',
    rule_id: 'R-DOOR-01', level: 'P2', status: 'pending',
    trigger_desc: '72小时未检测到出门记录', triggered_at: dayAgo,
  },
  {
    id: '6', elder_id: '6', elder_name: '陈奶奶', building: '5',
    rule_id: 'R-DEV-02', level: 'P2', status: 'closed',
    trigger_desc: '床垫传感器电量低于20%，请及时更换电池', triggered_at: dayAgo,
  },
  {
    id: '7', elder_id: '1', elder_name: '张大爷', building: '3',
    rule_id: 'R-BED-04', level: 'P1', status: 'closed_false_positive',
    trigger_desc: '连续在床时间超过12小时', triggered_at: dayAgo,
  },
]

export const mockElders: Elder[] = [
  { id: '1', name: '张大爷', gender: '男', age: 82, building: '3', unit: '1', room: '301', risk_class: 'A', plan_level: 'full' },
  { id: '2', name: '李奶奶', gender: '女', age: 78, building: '5', unit: '2', room: '502', risk_class: 'A', plan_level: 'full' },
  { id: '3', name: '王伯伯', gender: '男', age: 75, building: '3', unit: '1', room: '102', risk_class: 'B', plan_level: 'standard' },
  { id: '4', name: '赵阿姨', gender: '女', age: 80, building: '7', unit: '1', room: '701', risk_class: 'A', plan_level: 'full' },
  { id: '5', name: '刘大爷', gender: '男', age: 85, building: '2', unit: '3', room: '203', risk_class: 'B', plan_level: 'standard' },
  { id: '6', name: '陈奶奶', gender: '女', age: 73, building: '5', unit: '1', room: '501', risk_class: 'C', plan_level: 'basic' },
  { id: '7', name: '孙大爷', gender: '男', age: 88, building: '1', unit: '2', room: '101', risk_class: 'A', plan_level: 'full' },
  { id: '8', name: '周阿姨', gender: '女', age: 76, building: '2', unit: '1', room: '302', risk_class: 'B', plan_level: 'standard' },
]

export const mockStats = {
  pending_count: 3,
  processing_count: 2,
  closed_today: 5,
  total_elders: 8,
}

export const mockAlertDetail = {
  ...mockAlerts[0],
  elder: mockElders[0],
  timeline: [
    { id: '1', type: 'triggered', note: '规则 R-BTN 触发：一键报警按钮被按下', operator: '系统', created_at: now },
    { id: '2', type: 'notified', note: '钉钉通知已推送至责任社工李姐', operator: '系统', created_at: now },
  ],
}

export const mockMeals: MealRecord[] = [
  { id: '1', elder_id: '1', elder_name: '张大爷', meal_date: now.slice(0, 10), meal_type: 'lunch', check_method: 'manual', amount: 12, checked_at: now },
  { id: '2', elder_id: '2', elder_name: '李奶奶', meal_date: now.slice(0, 10), meal_type: 'lunch', check_method: 'scan', amount: 12, checked_at: now },
  { id: '3', elder_id: '3', elder_name: '王伯伯', meal_date: now.slice(0, 10), meal_type: 'breakfast', check_method: 'manual', amount: 8, checked_at: hourAgo },
]

/** 根据路径返回 mock 数据 */
export function getMockResponse(url: string): unknown {
  if (url.includes('/alerts/') && !url.endsWith('/handle')) {
    return mockAlertDetail
  }
  if (url.includes('/alerts')) {
    return { items: mockAlerts, total: mockAlerts.length }
  }
  if (url.includes('/elders/')) {
    return { ...mockElders[0], emergency_contacts: [{ name: '张小明', relation: '儿子', phone: '138****1234' }], devices: [{ type: 'bed', location: '卧室', online: true, battery_pct: 85 }] }
  }
  if (url.includes('/elders')) {
    return { items: mockElders, total: mockElders.length }
  }
  if (url.includes('/me/stats')) {
    return mockStats
  }
  if (url.includes('/meals/stats')) {
    return { total_today: 18, breakfast: 6, lunch: 8, dinner: 4 }
  }
  if (url.includes('/meals')) {
    return { items: mockMeals, total: mockMeals.length }
  }
  if (url.includes('/workers')) {
    return { items: [{ id: '1', name: '李姐', role: 'social_worker', phone: '139****5678', on_duty: true }], total: 1 }
  }
  return {}
}
