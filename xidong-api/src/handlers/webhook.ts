/**
 * Webhook Handler
 * POST /webhook/tuya — 涂鸦设备事件接入（Pulsar HTTP 桥接）
 * POST /webhook/dingtalk — 钉钉卡片按钮回调
 */

import type { SensorEvent, DeviceType, EventType, ElderContext } from '../types/index.js';
import { ingestEvent, pipeline, computeBedAccum } from '../rules/engine.js';
import redis from '../db/redis.js';
import { createAlert } from './alert.js';
import { notifyAlert } from '../services/notify.js';
import { SensorEventDao } from '../db/dao.js';
import { createHmac } from 'node:crypto';

// ─── 设备映射表（涂鸦 devId → elderId + 设备元信息）───
// MVP 阶段从 Redis hash 'device_map:{devId}' 读取
// 生产环境从 MySQL device 表查

interface DeviceMapping {
  elderId: string;
  deviceType: DeviceType;
  location: string;
}

async function getDeviceMapping(devId: string): Promise<DeviceMapping | null> {
  const key = `device_map:${devId}`;
  const data = await redis.hgetall(key);
  if (!data.elderId) return null;
  return {
    elderId: data.elderId,
    deviceType: data.deviceType as DeviceType,
    location: data.location || 'unknown',
  };
}

// ─── 涂鸦 DP 码 → 标准事件类型 ───

interface TuyaStatus {
  code: string;
  value: unknown;
  t: number;
}

interface TuyaWebhookBody {
  devId: string;
  productKey?: string;
  dataId?: string;
  status: TuyaStatus[];
}

function parseTuyaEvent(
  status: TuyaStatus,
  deviceType: DeviceType
): { eventType: EventType; payload: Record<string, unknown> } | null {
  switch (deviceType) {
    case 'button':
      if (status.code === 'switch_alarm' && status.value === true) {
        return { eventType: 'button_hold', payload: { hold_sec: 3 } };
      }
      break;
    case 'bed':
      if (status.code === 'presence_state') {
        const eventType: EventType = status.value === 'presence' ? 'on_bed' : 'off_bed';
        return { eventType, payload: {} };
      }
      break;
    case 'pir':
      if (status.code === 'pir') {
        const eventType: EventType = status.value === 'pir' ? 'pir_active' : 'pir_clear';
        return { eventType, payload: {} };
      }
      break;
    case 'door':
      if (status.code === 'doorcontact_state') {
        const eventType: EventType = status.value === true ? 'door_open' : 'door_close';
        return { eventType, payload: { battery_pct: (status as unknown as Record<string, unknown>).battery_pct } };
      }
      break;
  }
  return null;
}

// ─── 涂鸦 Webhook 入口 ───

export async function handleTuyaWebhook(
  body: unknown,
  headers: Record<string, string>
): Promise<{ status: number; body: Record<string, unknown> }> {
  const payload = body as TuyaWebhookBody;

  // 基本校验
  if (!payload?.devId || !Array.isArray(payload.status)) {
    return { status: 400, body: { error: 'invalid tuya payload' } };
  }

  // 涂鸦签名验证 (TUYA_MOCK=true 时跳过)
  if (process.env.TUYA_MOCK !== 'true') {
    const sign = headers['x-tuya-sign'] || headers['X-Tuya-Sign'];
    const ts = headers['x-tuya-t'] || headers['X-Tuya-T'] || '';
    if (!verifyTuyaSign(sign, ts, JSON.stringify(body))) {
      console.warn(`[Tuya] signature verification failed for ${payload.devId}`);
      return { status: 401, body: { error: 'invalid signature' } };
    }
  }

  // 查设备映射
  const mapping = await getDeviceMapping(payload.devId);
  if (!mapping) {
    console.warn(`[Tuya] unknown device: ${payload.devId}`);
    return { status: 200, body: { success: true, msg: 'device not mapped, ignored' } };
  }

  const results: string[] = [];

  for (const st of payload.status) {
    const parsed = parseTuyaEvent(st, mapping.deviceType);
    if (!parsed) continue;

    const event: SensorEvent = {
      elderId: mapping.elderId,
      deviceId: payload.devId,
      deviceType: mapping.deviceType,
      eventType: parsed.eventType,
      payload: { location: mapping.location, ...parsed.payload },
      ts: new Date(st.t * 1000),
    };

    // 摄入 Redis
    await ingestEvent(event);
    results.push(event.eventType);

    // 落库 MySQL sensor_event
    SensorEventDao.create({
      elder_id: mapping.elderId,
      device_id: payload.devId,
      event_type: event.eventType,
      payload: JSON.stringify(event.payload),
      event_time: event.ts.toISOString(),
    }).catch(err => console.error('[Tuya] sensor_event persist failed:', err));

    // 床压事件时更新夜间累计
    if (event.eventType === 'on_bed' || event.eventType === 'off_bed') {
      computeBedAccum(mapping.elderId).catch(() => {});
    }

    // 评估规则 + 生成告警 + 推送
    const ctx = await getElderContext(mapping.elderId);
    const candidates = await pipeline(mapping.elderId, ctx);
    const active = candidates.filter(c => !c.suppressed);

    for (const candidate of active) {
      const alert = await createAlert({
        id: `alt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        elder_id: candidate.elderId,
        elder_name: ctx.name,
        building: ctx.building,
        rule_id: candidate.ruleId,
        level: candidate.level,
        trigger_desc: candidate.reason,
        triggered_at: new Date().toISOString(),
      });

      // 异步推送（不阻塞主流程）
      notifyAlert({
        alertId: alert.id,
        elderName: ctx.name,
        building: ctx.building,
        room: '',
        ruleId: candidate.ruleId,
        level: candidate.level,
        triggerDesc: candidate.reason,
        triggeredAt: alert.triggered_at,
      }).catch(() => {});
    }
  }

  console.log(`[Tuya] ${payload.devId} → ${results.join(', ') || 'no events parsed'}`);
  return { status: 200, body: { success: true, events: results } };
}

// ─── 钉钉卡片回调 ───

/**
 * 钉钉互动卡片按钮回调
 * 社工点击「接单」「误报」「已处置」按钮时触发
 *
 * 卡片回调 body 格式 (钉钉规范):
 * {
 *   outTrackId: string,     // 我们用 alertId
 *   userId: string,         // 钉钉 userId
 *   content: { cardPrivateData: { actionType: 'acknowledge'|'close'|'false_positive', note?: string, reason?: string } }
 * }
 */
interface DingtalkCardCallback {
  outTrackId: string;
  userId: string;
  content: {
    cardPrivateData: {
      actionType: 'acknowledge' | 'close' | 'false_positive';
      note?: string;
      reason?: string;
    };
  };
}

export async function handleDingtalkWebhook(
  body: unknown,
  _headers: Record<string, string>
): Promise<{ status: number; body: Record<string, unknown> }> {
  const payload = body as DingtalkCardCallback;

  // 钉钉回调签名验证
  const DINGTALK_APP_SECRET = process.env.DINGTALK_APP_SECRET || '';
  if (DINGTALK_APP_SECRET) {
    const timestamp = _headers['timestamp'] || _headers['Timestamp'] || '';
    const sign = _headers['sign'] || _headers['Sign'] || '';
    if (!verifyDingtalkSign(timestamp, sign, DINGTALK_APP_SECRET)) {
      console.warn('[DingTalk] signature verification failed');
      return { status: 401, body: { error: 'invalid dingtalk signature' } };
    }
  } else if (process.env.NODE_ENV === 'production') {
    console.error('[DingTalk] DINGTALK_APP_SECRET not configured in production!');
    return { status: 500, body: { error: 'server misconfiguration' } };
  }

  if (!payload?.outTrackId || !payload?.content?.cardPrivateData?.actionType) {
    return { status: 400, body: { error: 'invalid dingtalk callback payload' } };
  }

  const alertId = payload.outTrackId;
  const operatorId = payload.userId || 'dingtalk_user';
  const { actionType, note, reason } = payload.content.cardPrivateData;

  // 映射钉钉卡片按钮 → 告警处置 action
  const actionMap: Record<string, string> = {
    acknowledge: 'acknowledge',
    close: 'safe',
    false_positive: 'false_positive',
  };

  const action = actionMap[actionType];
  if (!action) {
    return { status: 400, body: { error: `unknown actionType: ${actionType}` } };
  }

  const { handleAlert } = await import('./alert.js');
  const result = await handleAlert(
    alertId,
    action as 'acknowledge' | 'safe' | 'false_positive' | 'dispatch' | 'visit_done',
    operatorId,
    note,
    reason as 'bathing' | 'visitor' | 'pet' | 'device_fault' | 'other' | undefined,
  );

  console.log(`[DingTalk] callback: ${actionType} on ${alertId} by ${operatorId} → ${result.status}`);

  // 返回卡片更新（钉钉要求返回特定格式）
  return {
    status: 200,
    body: {
      cardUpdateAction: {
        cardPrivateData: {
          actionType: 'toast',
          params: { content: result.status === 200 ? '处理成功' : '处理失败' },
        },
      },
    },
  };
}

// ─── 获取老人上下文（从 Redis elder hash 读取） ───

async function getElderContext(elderId: string): Promise<ElderContext> {
  const raw = await redis.hgetall(`elder:${elderId}`);

  // 如果无数据，返回默认上下文
  if (!raw.id) {
    return {
      id: elderId,
      name: '未知老人',
      building: '0',
      planLevel: 'basic',
      riskClass: 'C',
      status: 'home',
      isHomebound: false,
      propertyPhone: '',
      habitProfile: {
        tSleep: '22:00',
        deltaMin: 90,
        bedLeaveMin: 30,
        bathThresholdMin: 30,
        installDays: 7,
        baselineReady: false,
      },
    };
  }

  return {
    id: raw.id,
    name: raw.name,
    building: raw.building,
    planLevel: (raw.plan_level || 'basic') as ElderContext['planLevel'],
    riskClass: (raw.risk_class || 'C') as ElderContext['riskClass'],
    status: (raw.status || 'home') as ElderContext['status'],
    isHomebound: raw.is_homebound === 'true',
    propertyPhone: raw.property_phone || '',
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

// ─── 涂鸦签名验证 ───

const TUYA_ACCESS_SECRET = process.env.TUYA_ACCESS_SECRET || '';

function verifyTuyaSign(sign: string | undefined, timestamp: string, bodyStr: string): boolean {
  if (!sign || !TUYA_ACCESS_SECRET) return false;
  const strToSign = `${TUYA_ACCESS_SECRET}${timestamp}${bodyStr}`;
  const expected = createHmac('sha256', TUYA_ACCESS_SECRET).update(strToSign).digest('hex').toUpperCase();
  return sign.toUpperCase() === expected;
}

// ─── 钉钉回调签名验证 ───

/**
 * 钉钉互动卡片回调签名验证
 * 算法：HmacSHA256(timestamp + "\n" + appSecret, appSecret)
 * 参考：https://open.dingtalk.com/document/orgapp/callback-overview
 */
function verifyDingtalkSign(timestamp: string, sign: string, appSecret: string): boolean {
  if (!timestamp || !sign || !appSecret) return false;
  // 检查时间戳是否过期（1小时内有效）
  const ts = Number(timestamp);
  if (Math.abs(Date.now() - ts) > 3600_000) return false;
  const strToSign = `${timestamp}\n${appSecret}`;
  const expected = createHmac('sha256', appSecret).update(strToSign).digest('base64');
  return sign === expected;
}
