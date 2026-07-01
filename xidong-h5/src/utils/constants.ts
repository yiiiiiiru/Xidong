/**
 * 业务常量配置
 * 集中管理散落在各组件中的硬编码值，便于维护和国际化
 */

// ─── 楼幢配置 ───

export const BUILDING_OPTIONS = [
  { text: '全部楼幢', value: '' },
  { text: '3幢', value: '3' },
  { text: '5幢', value: '5' },
  { text: '7幢', value: '7' },
]

// ─── 护理等级选项 ───

export const PLAN_LEVEL_OPTIONS = [
  { text: '全部等级', value: '' },
  { text: '全护理', value: 'full' },
  { text: '标准护理', value: 'standard' },
  { text: '基础护理', value: 'basic' },
]

export const PLAN_PICKER_COLUMNS = [
  { text: '全护理', value: 'full' },
  { text: '标准', value: 'standard' },
  { text: '基础', value: 'basic' },
]

// ─── 风险等级 ───

export const RISK_LABELS: Record<string, string> = {
  A: '高风险', B: '中风险', C: '低风险',
}

export const RISK_COLORS: Record<string, 'danger' | 'warning' | 'success' | 'default'> = {
  A: 'danger', B: 'warning', C: 'success',
}

export const RISK_ACTIONS = [
  { name: 'A — 高风险（独居/高龄）', value: 'A' },
  { name: 'B — 中风险', value: 'B' },
  { name: 'C — 低风险', value: 'C' },
]

export const RISK_PICKER_COLUMNS = [
  { text: 'A级（高风险）', value: 'A' },
  { text: 'B级（中风险）', value: 'B' },
  { text: 'C级（低风险）', value: 'C' },
]

export const PLAN_ACTIONS = [
  { name: '全覆盖（full）', value: 'full' },
  { name: '标准（standard）', value: 'standard' },
  { name: '基础（basic）', value: 'basic' },
]

// ─── 角色配置 ───

export const ROLE_OPTIONS = [
  { text: '全部角色', value: '' },
  { text: '社工', value: 'social_worker' },
  { text: '备班', value: 'backup' },
  { text: '楼长', value: 'building_manager' },
  { text: '主任', value: 'director' },
  { text: '物业', value: 'property' },
]

export const WORKER_ROLE_ACTIONS = [
  { name: '社工', value: 'social_worker' },
  { name: '备班', value: 'backup' },
  { name: '楼长', value: 'building_manager' },
  { name: '主任', value: 'director' },
  { name: '物业', value: 'property' },
]

// ─── 餐次配置 ───

/** 餐次时间阈值（小时），用于自动判断当前餐次 */
export const MEAL_TIME_THRESHOLDS = {
  BREAKFAST_END: 10,  // 10点前算早餐
  LUNCH_END: 14,      // 14点前算午餐
  // 14点后算晚餐
}

export const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: '早餐', lunch: '午餐', dinner: '晚餐',
}

// ─── 规则标签 ───

export const RULE_LABELS: Record<string, string> = {
  'R-BTN': '一键报警',
  'R-MIX-01': '夜间离床+厕所',
  'R-MIX-02': '应睡未睡+未出门',
  'R-BED-01': '夜间离床',
  'R-BED-02': '应睡未睡',
  'R-BED-03': '整夜在床不足',
  'R-BED-04': '连续在床',
  'R-BATH-01': '卫生间滞留',
  'R-DOOR-01': '72h未出门',
  'R-DOOR-02': '门长开',
  'R-DEV-01': '设备离线',
  'R-DEV-02': '电量低',
}

// ─── 误报原因标签 ───

export const FP_REASON_LABELS: Record<string, string> = {
  bathing: '洗澡',
  visitor: '有客人',
  pet: '宠物触发',
  device_fault: '设备故障',
  other: '其他',
}

// ─── 设备类型 ───

export const DEVICE_TYPE_LABELS: Record<string, string> = {
  door: '入户门磁',
  bed: '床垫压感',
  pir: '人体传感器',
  button: '床头按钮',
}

// ─── 老人状态操作 ───

export const ELDER_STATUS_ACTIONS = [
  { name: '正常在住', value: 'home' },
  { name: '外出', value: 'away' },
  { name: '住院', value: 'hospital' },
]
