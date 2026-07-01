/**
 * 告警相关 Handler
 * GET /api/alerts
 * GET /api/alerts/:id
 * PUT /api/alerts/:id/handle
 *
 * 持久化: MySQL (via DAO)
 * Redis 保留: dedup / false_positive 抑制 / escalation 状态
 */
import type {
  AlertAction, AlertLevel, AlertStatus,
  FalsePositiveReason, TimelineEventType, PaginatedResponse,
} from '../types/index.js';
import { AlertDao, ElderDao } from '../db/dao.js';
import redis, { RedisKeys } from '../db/redis.js';

// ─── 告警数据结构 ───

export interface AlertRecord {
  id: string;
  elder_id: string;
  elder_name: string;
  building: string;
  rule_id: string;
  level: AlertLevel;
  status: AlertStatus;
  trigger_desc: string;
  triggered_at: string;
  acknowledged_at?: string;
  closed_at?: string;
  handler_id?: string;
  handler_name?: string;
  note?: string;
  false_positive_reason?: FalsePositiveReason;
}

interface TimelineEntry {
  event: TimelineEventType;
  ts: string;
  operator?: string;
  note?: string;
}

// ─── 创建告警（供内部调用） ───

export async function createAlert(data: Omit<AlertRecord, 'status' | 'acknowledged_at' | 'closed_at' | 'handler_id' | 'handler_name' | 'note' | 'false_positive_reason'>): Promise<AlertRecord> {
  const alert: AlertRecord = {
    ...data,
    status: 'pending',
    triggered_at: data.triggered_at || new Date().toISOString(),
  };

  // MySQL 持久化
  await AlertDao.create({
    id: alert.id,
    elder_id: alert.elder_id,
    rule_id: alert.rule_id,
    level: alert.level,
    status: 'pending',
    trigger_desc: alert.trigger_desc,
    context_json: JSON.stringify({ elder_name: alert.elder_name, building: alert.building }),
    triggered_at: alert.triggered_at,
  });

  // 写时间线
  await AlertDao.addTimeline(alert.id, 'triggered', undefined, { elder_name: alert.elder_name });

  return alert;
}

// ─── GET /api/alerts ───

export async function listAlerts(query: {
  level?: AlertLevel;
  status?: AlertStatus;
  elderId?: string;
  page?: number;
  pageSize?: number;
  building?: string;
}): Promise<{ status: number; body: PaginatedResponse<AlertRecord> }> {
  const { items: rows, total } = await AlertDao.findAll({
    level: query.level,
    status: query.status,
    elderId: query.elderId,
    building: query.building,
    page: query.page,
    pageSize: query.pageSize,
  });

  // 批量查询关联老人（修复 N+1）
  const elderIds = [...new Set(rows.map(r => r.elder_id))];
  const elderMap = new Map<string, { name: string; building: string }>();
  if (elderIds.length > 0) {
    const elders = await ElderDao.findByIds(elderIds);
    for (const e of elders) {
      elderMap.set(e.id, { name: e.name, building: e.building });
    }
  }

  // 转换为 AlertRecord
  const alerts: AlertRecord[] = rows.map(row => {
    const elder = elderMap.get(row.elder_id);
    return {
      id: row.id,
      elder_id: row.elder_id,
      elder_name: elder?.name || '',
      building: elder?.building || '',
      rule_id: row.rule_id,
      level: row.level as AlertLevel,
      status: row.status as AlertStatus,
      trigger_desc: row.trigger_desc,
      triggered_at: String(row.triggered_at),
      closed_at: row.closed_at ? String(row.closed_at) : undefined,
      handler_id: row.handler_id || undefined,
      note: row.handler_note || undefined,
      false_positive_reason: row.false_positive_reason as FalsePositiveReason | undefined,
    };
  });

  return { status: 200, body: { items: alerts, total, page: query.page || 1, pageSize: query.pageSize || 20 } };
}

// ─── GET /api/alerts/:id ───

export async function getAlertDetail(alertId: string): Promise<{ status: number; body: Record<string, unknown> }> {
  const row = await AlertDao.findById(alertId);
  if (!row) {
    return { status: 404, body: { error: 'alert not found' } };
  }

  const elder = await ElderDao.findById(row.elder_id);
  const tlRows = await AlertDao.getTimeline(alertId);

  const timeline: TimelineEntry[] = tlRows.map(tl => ({
    event: (tl as { event_type: string }).event_type as TimelineEventType,
    ts: String((tl as { created_at: string }).created_at),
    operator: (tl as { meta: string | null }).meta
      ? (JSON.parse((tl as { meta: string }).meta) as { operator?: string }).operator
      : undefined,
  }));

  const alert: AlertRecord = {
    id: row.id,
    elder_id: row.elder_id,
    elder_name: elder?.name || '',
    building: elder?.building || '',
    rule_id: row.rule_id,
    level: row.level as AlertLevel,
    status: row.status as AlertStatus,
    trigger_desc: row.trigger_desc,
    triggered_at: String(row.triggered_at),
    closed_at: row.closed_at ? String(row.closed_at) : undefined,
    handler_id: row.handler_id || undefined,
    note: row.handler_note || undefined,
    false_positive_reason: row.false_positive_reason as FalsePositiveReason | undefined,
  };

  return {
    status: 200,
    body: { ...alert, timeline },
  };
}

// ─── PUT /api/alerts/:id/handle ───

const VALID_TRANSITIONS: Record<AlertStatus, AlertAction[]> = {
  pending: ['acknowledge', 'false_positive'],
  processing: ['safe', 'false_positive', 'dispatch'],
  dispatched: ['visit_done'],
  closed: [],
  closed_false_positive: [],
};

const ACTION_TO_STATUS: Record<AlertAction, AlertStatus> = {
  acknowledge: 'processing',
  safe: 'closed',
  false_positive: 'closed_false_positive',
  dispatch: 'dispatched',
  visit_done: 'closed',
};

export async function handleAlert(
  alertId: string,
  action: AlertAction,
  operatorId: string,
  note?: string,
  falsePositiveReason?: FalsePositiveReason
): Promise<{ status: number; body: Record<string, unknown> }> {
  const row = await AlertDao.findById(alertId);
  if (!row) {
    return { status: 404, body: { error: 'alert not found' } };
  }

  const currentStatus = row.status as AlertStatus;
  const allowed = VALID_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(action)) {
    return {
      status: 422,
      body: { error: 'invalid_action', current_status: currentStatus, allowed },
    };
  }

  const newStatus = ACTION_TO_STATUS[action];
  const now = new Date().toISOString().replace('T', ' ').replace('Z', '');

  // MySQL 更新
  const updates: Record<string, string> = {
    status: newStatus,
    handler_id: operatorId,
  };
  if (note) updates.handler_note = note;
  if (action === 'acknowledge') updates.handled_at = now;
  if (newStatus === 'closed' || newStatus === 'closed_false_positive') updates.closed_at = now;
  if (falsePositiveReason) {
    updates.false_positive_reason = falsePositiveReason;
    // Redis: 7天误报抑制（规则引擎读取）
    await redis.set(RedisKeys.falsePositive(row.elder_id, row.rule_id), '1', 'EX', 7 * 86400);
    // MySQL: 误报日志
    await AlertDao.addFalsePositiveLog(alertId, row.elder_id, row.rule_id, falsePositiveReason, operatorId);
  }

  await AlertDao.update(alertId, updates);

  // 写时间线
  const tlEvent = actionToTimelineEvent(action);
  await AlertDao.addTimeline(alertId, tlEvent, undefined, { operator: operatorId, note });

  console.log(`[Alert] ${alertId}: ${currentStatus} → ${newStatus} (${action} by ${operatorId})`);

  return {
    status: 200,
    body: { success: true, alert_id: alertId, new_status: newStatus },
  };
}

// ─── 工具函数 ───

function actionToTimelineEvent(action: AlertAction): TimelineEventType {
  const map: Record<AlertAction, TimelineEventType> = {
    acknowledge: 'acknowledged',
    safe: 'closed',
    false_positive: 'closed',
    dispatch: 'dispatched',
    visit_done: 'closed',
  };
  return map[action];
}
