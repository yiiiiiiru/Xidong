/**
 * 溪东社区智慧养老 MVP — 全局类型定义
 * 对齐系统设计 §6.2 + §7
 */

// ==================== 设备与事件 ====================

export type DeviceType = 'button' | 'bed' | 'pir' | 'door';

export type EventType =
  | 'button_hold'
  | 'on_bed'
  | 'off_bed'
  | 'pir_active'
  | 'pir_clear'
  | 'door_open'
  | 'door_close';

export interface SensorEvent {
  elderId: string;
  deviceId: string;
  deviceType: DeviceType;
  eventType: EventType;
  payload: Record<string, unknown>;
  ts: Date;
}

// ==================== 老人上下文 ====================

export type RiskClass = 'A' | 'B' | 'C';
export type PlanLevel = 'full' | 'standard' | 'basic';
export type ElderStatusType = 'home' | 'away' | 'hospital' | 'paused';

export interface HabitProfile {
  tSleep: string;           // "22:00"
  deltaMin: number;         // 90
  bedLeaveMin: number;      // 30
  bathThresholdMin: number; // 30
  installDays: number;      // 冷启动天数
  baselineReady: boolean;
}

export interface ElderContext {
  id: string;
  name: string;
  building: string;
  planLevel: PlanLevel;
  riskClass: RiskClass;
  status: ElderStatusType;
  statusWindow?: { start: Date; end: Date };
  isHomebound: boolean;
  propertyPhone: string;
  habitProfile: HabitProfile;
}

// ==================== 告警 ====================

export type AlertLevel = 'P0' | 'P1' | 'P2';

export type AlertStatus =
  | 'pending'
  | 'processing'
  | 'dispatched'
  | 'closed'
  | 'closed_false_positive';

export type AlertAction =
  | 'acknowledge'
  | 'safe'
  | 'false_positive'
  | 'dispatch'
  | 'visit_done';

export type FalsePositiveReason =
  | 'bathing'
  | 'visitor'
  | 'pet'
  | 'device_fault'
  | 'other';

export type SuppressReason =
  | 'away'
  | 'hospital'
  | 'paused'
  | 'false_positive'
  | 'priority';

export interface AlertCandidate {
  ruleId: string;
  level: AlertLevel;
  elderId: string;
  reason: string;
  context: Record<string, unknown>;
  suppressed?: boolean;
  suppressReason?: SuppressReason;
}

export type TimelineEventType =
  | 'triggered'
  | 'pushed'
  | 'acknowledged'
  | 'suppressed'
  | 'escalated'
  | 'closed'
  | 'dispatched';

// ==================== 规则配置 ====================

export interface RuleConfig {
  id: string;
  level: AlertLevel;
  planLevels: PlanLevel[];
  penetrateSuppress?: boolean;
  skipDedup?: boolean;
  condition: Record<string, unknown>;
}

// ==================== RBAC ====================

export type UserRole =
  | 'social_worker'
  | 'backup'
  | 'building_manager'
  | 'director'
  | 'property';

export interface AuthUser {
  userId: string;
  role: UserRole;
  building?: string;
  name: string;
}

// ==================== API Response ====================

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiError {
  error: string;
  details?: unknown;
}
