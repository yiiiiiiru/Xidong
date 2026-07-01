/**
 * 告警状态/等级映射 — 统一复用
 * 消除 AlertDetail、Workbench、AlertCard 等多处重复定义
 */

// ─── 告警等级 ───

export type AlertLevel = 'P0' | 'P1' | 'P2'

const LEVEL_LABELS: Record<string, string> = {
  P0: '紧急', P1: '注意', P2: '提示',
}

const LEVEL_TAG_TYPES: Record<string, 'danger' | 'warning' | 'primary'> = {
  P0: 'danger', P1: 'warning', P2: 'primary',
}

const LEVEL_BG_CLASSES: Record<string, string> = {
  P0: 'level-bg-p0', P1: 'level-bg-p1', P2: 'level-bg-p2',
}

export function getLevelLabel(level: string): string {
  return LEVEL_LABELS[level] || level
}

export function getLevelTagType(level: string): 'danger' | 'warning' | 'primary' {
  return LEVEL_TAG_TYPES[level] || 'primary'
}

export function getLevelBgClass(level: string): string {
  return LEVEL_BG_CLASSES[level] || 'level-bg-p2'
}

// ─── 告警状态 ───

export type AlertStatus = 'pending' | 'processing' | 'closed' | 'closed_false_positive' | 'dispatched'

const STATUS_LABELS: Record<string, string> = {
  pending: '待处理',
  processing: '处理中',
  closed: '已关闭',
  closed_false_positive: '误报关闭',
  dispatched: '已派单',
}

const STATUS_TAG_TYPES: Record<string, 'danger' | 'warning' | 'success' | 'primary'> = {
  pending: 'danger',
  processing: 'warning',
  closed: 'success',
  closed_false_positive: 'success',
  dispatched: 'primary',
}

export function getStatusLabel(status: string): string {
  return STATUS_LABELS[status] || status
}

export function getStatusTagType(status: string): 'danger' | 'warning' | 'success' | 'primary' {
  return STATUS_TAG_TYPES[status] || 'primary'
}

// ─── 老人状态 ───

const ELDER_STATUS_LABELS: Record<string, string> = {
  home: '正常在住', away: '外出', hospital: '住院', paused: '暂停监护',
}

const ELDER_STATUS_TAG_TYPES: Record<string, 'success' | 'warning' | 'primary'> = {
  home: 'success', away: 'warning', hospital: 'primary',
}

export function getElderStatusLabel(status: string): string {
  return ELDER_STATUS_LABELS[status] || status
}

export function getElderStatusTagType(status: string): 'success' | 'warning' | 'primary' {
  return ELDER_STATUS_TAG_TYPES[status] || 'primary'
}

// ─── 护理等级 ───

const PLAN_LABELS: Record<string, string> = {
  full: '全护理', standard: '标准', basic: '基础',
}

const PLAN_TAG_TYPES: Record<string, 'danger' | 'warning' | 'primary'> = {
  full: 'danger', standard: 'warning', basic: 'primary',
}

export function getPlanLabel(level: string): string {
  return PLAN_LABELS[level] || level
}

export function getPlanTagType(level: string): 'danger' | 'warning' | 'primary' {
  return PLAN_TAG_TYPES[level] || 'primary'
}

// ─── 风险等级 ───

const RISK_TAG_TYPES: Record<string, 'danger' | 'warning' | 'success'> = {
  A: 'danger', B: 'warning', C: 'success',
}

export function getRiskTagType(riskClass: string): 'danger' | 'warning' | 'success' {
  return RISK_TAG_TYPES[riskClass] || 'success'
}

// ─── 工作人员角色 ───

const WORKER_ROLE_LABELS: Record<string, string> = {
  social_worker: '社工',
  backup: '备班',
  building_manager: '楼长',
  director: '主任',
  property: '物业',
}

export function getWorkerRoleLabel(role: string): string {
  return WORKER_ROLE_LABELS[role] || role
}
