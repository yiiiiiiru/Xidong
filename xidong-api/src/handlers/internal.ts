/**
 * 内部 API（仅 dev 环境）
 * POST /internal/mock-alert — 注入一条 mock 告警
 * POST /internal/mock-event — 注入原始传感器事件并评估规则
 * POST /internal/seed-devices — 初始化设备映射 (Redis)
 */
import type { SensorEvent, AlertLevel, DeviceType, EventType, ElderContext } from '../types/index.js';
import { ingestEvent, pipeline } from '../rules/engine.js';
import redis, { RedisKeys } from '../db/redis.js';
import { createAlert } from './alert.js';

// ─── POST /internal/mock-alert ───

export async function mockAlert(body: {
  elder_id: string;
  rule_id: string;
  level: AlertLevel;
  trigger_desc?: string;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  if (process.env.NODE_ENV === 'production') {
    return { status: 403, body: { error: 'Not available in production' } };
  }

  // 调用真实 createAlert 逻辑
  const alert = await createAlert({
    id: `mock_${Date.now()}`,
    elder_id: body.elder_id,
    elder_name: '测试老人',
    building: '3',
    rule_id: body.rule_id,
    level: body.level,
    trigger_desc: body.trigger_desc || `Mock alert: ${body.rule_id}`,
    triggered_at: new Date().toISOString(),
  });

  console.log(`[Mock] alert created: ${body.rule_id} (${body.level}) for ${body.elder_id}`);
  return { status: 201, body: { success: true, alert } };
}

// ─── POST /internal/mock-event ───

interface MockEventBody {
  elder_id: string;
  device_type: DeviceType;
  event_type: EventType;
  location?: string;
  payload?: Record<string, unknown>;
}

export async function mockEvent(body: MockEventBody): Promise<{ status: number; body: Record<string, unknown> }> {
  if (process.env.NODE_ENV === 'production') {
    return { status: 403, body: { error: 'Not available in production' } };
  }

  const event: SensorEvent = {
    elderId: body.elder_id,
    deviceId: `mock_${body.device_type}_001`,
    deviceType: body.device_type,
    eventType: body.event_type,
    payload: { location: body.location || 'unknown', ...body.payload },
    ts: new Date(),
  };

  // 摄入事件
  await ingestEvent(event);

  // 评估规则（使用 mock 上下文）
  const ctx = await getMockElderContext(body.elder_id);
  const candidates = await pipeline(body.elder_id, ctx);

  const active = candidates.filter(c => !c.suppressed);
  const suppressed = candidates.filter(c => c.suppressed);

  console.log(`[Mock] event: ${body.event_type}, candidates: ${candidates.length}, active: ${active.length}`);

  return {
    status: 200,
    body: {
      success: true,
      event: { type: event.eventType, device: event.deviceType },
      evaluation: {
        total: candidates.length,
        active: active.map(c => ({ rule: c.ruleId, level: c.level, reason: c.reason })),
        suppressed: suppressed.map(c => ({ rule: c.ruleId, reason: c.suppressReason })),
      },
    },
  };
}

// ─── POST /internal/seed-devices ───

interface SeedDeviceItem {
  devId: string;
  elderId: string;
  deviceType: DeviceType;
  location: string;
}

export async function seedDevices(body: {
  devices: SeedDeviceItem[];
}): Promise<{ status: number; body: Record<string, unknown> }> {
  if (process.env.NODE_ENV === 'production') {
    return { status: 403, body: { error: 'Not available in production' } };
  }

  let count = 0;
  for (const d of body.devices) {
    const key = `device_map:${d.devId}`;
    await redis.hset(key, 'elderId', d.elderId, 'deviceType', d.deviceType, 'location', d.location);
    count++;
  }

  console.log(`[Seed] ${count} devices mapped`);
  return { status: 200, body: { success: true, count } };
}

// ─── Mock 老人上下文 ───

async function getMockElderContext(elderId: string): Promise<ElderContext> {
  // ponytail: 固定 mock，不查 DB
  return {
    id: elderId,
    name: '张阿婆',
    building: '3',
    planLevel: 'full',
    riskClass: 'A',
    status: 'home',
    isHomebound: false,
    propertyPhone: '13800138000',
    habitProfile: {
      tSleep: '22:00',
      deltaMin: 90,
      bedLeaveMin: 30,
      bathThresholdMin: 30,
      installDays: 30,
      baselineReady: true,
    },
  };
}
