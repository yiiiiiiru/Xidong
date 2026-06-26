/**
 * 规则引擎 v2 — 核心评估
 *
 * 流程：ingestEvent → evaluate → applySuppression → applyDedup
 *
 * 对齐系统设计 §6, 规则编码 R-BTN ~ R-DEV-02
 *
 * @module rules/engine
 */

import dayjs from 'dayjs';
import type {
  SensorEvent,
  ElderContext,
  AlertCandidate,
  AlertLevel,
  PlanLevel,
  RuleConfig,
} from '../types/index.js';
import redis, { RedisKeys } from '../db/redis.js';
import { applySuppression, getEffectiveStatus } from './status-guard.js';
import { applyDedup } from './dedup.js';
import rulesConfig from './rules.json' with { type: 'json' };

// ─── 规则配置加载 ───

const rules: RuleConfig[] = rulesConfig as unknown as RuleConfig[];

// ─── 事件摄入 ───

/**
 * 将传感器事件写入 Redis 48h 窗口 + 更新状态 Hash
 */
export async function ingestEvent(event: SensorEvent): Promise<void> {
  const evtKey = RedisKeys.events(event.elderId);
  const stateKey = RedisKeys.state(event.elderId);
  const serialized = JSON.stringify({
    ...event,
    ts: event.ts.toISOString(),
  });

  // LPUSH + LTRIM 保持 48h 窗口（按条数限制，约 2000 条/人/48h）
  await redis.lpush(evtKey, serialized);
  await redis.ltrim(evtKey, 0, 1999);
  await redis.expire(evtKey, 48 * 3600); // 48h TTL

  // 更新状态 Hash
  const now = event.ts.toISOString();
  switch (event.eventType) {
    case 'on_bed':
      await redis.hset(stateKey, 'in_bed', '1', 'in_bed_since', now);
      await computeBedAccum(event.elderId);
      break;
    case 'off_bed':
      await redis.hset(stateKey, 'in_bed', '0', 'off_bed_since', now);
      await computeBedAccum(event.elderId);
      break;
    case 'pir_active':
      await redis.hset(
        stateKey,
        `pir_${event.payload['location'] || 'unknown'}`,
        '1',
        `pir_${event.payload['location'] || 'unknown'}_since`,
        now
      );
      break;
    case 'pir_clear':
      await redis.hset(
        stateKey,
        `pir_${event.payload['location'] || 'unknown'}`,
        '0'
      );
      break;
    case 'door_open':
      await redis.hset(stateKey, 'door_open', '1', 'door_open_since', now, 'last_door_open', now);
      break;
    case 'door_close':
      await redis.hset(stateKey, 'door_open', '0');
      break;
    case 'button_hold':
      await redis.hset(stateKey, 'last_button', now);
      break;
  }

  // 记录最后事件时间
  await redis.hset(stateKey, 'last_event', now);
}

// ─── 规则评估 ───

/**
 * 评估所有规则，返回候选告警列表
 */
export async function evaluate(
  elderId: string,
  ctx: ElderContext
): Promise<AlertCandidate[]> {
  const candidates: AlertCandidate[] = [];
  const stateKey = RedisKeys.state(elderId);
  const state = await redis.hgetall(stateKey);
  const now = dayjs();

  for (const rule of rules) {
    // 方案等级过滤
    if (!rule.planLevels.includes(ctx.planLevel)) continue;

    const condition = rule.condition as Record<string, unknown>;
    const result = evaluateRule(rule.id, condition, state, ctx, now);

    if (result) {
      candidates.push({
        ruleId: rule.id,
        level: rule.level as AlertLevel,
        elderId,
        reason: result.reason,
        context: result.context,
      });
    }
  }

  return candidates;
}

/**
 * 评估单条规则
 */
function evaluateRule(
  ruleId: string,
  condition: Record<string, unknown>,
  state: Record<string, string>,
  ctx: ElderContext,
  now: dayjs.Dayjs
): { reason: string; context: Record<string, unknown> } | null {
  switch (ruleId) {
    case 'R-BTN':
      return evalButtonHold(state, now);
    case 'R-MIX-01':
      return evalMix01(state, ctx, now);
    case 'R-MIX-02':
      return evalMix02(state, ctx, now);
    case 'R-BED-01':
      return evalBed01(state, ctx, now);
    case 'R-BED-02':
      return evalBed02(state, ctx, now);
    case 'R-BED-03':
      return evalBed03(state, ctx, now);
    case 'R-BED-04':
      return evalBed04(state, now);
    case 'R-BATH-01':
      return evalBath01(state, ctx, now);
    case 'R-DOOR-01':
      return evalDoor01(state, ctx, now);
    case 'R-DOOR-02':
      return evalDoor02(state, now);
    case 'R-DEV-01':
      return evalDev01(state, now);
    case 'R-DEV-02':
      return evalDev02(state);
    default:
      return null;
  }
}

// ─── 规则实现 ───

/** R-BTN: 按键长按 >= 2s（即时） */
function evalButtonHold(
  state: Record<string, string>,
  now: dayjs.Dayjs
): ReturnType<typeof evaluateRule> {
  const lastButton = state['last_button'];
  if (!lastButton) return null;

  const diff = now.diff(dayjs(lastButton), 'second');
  // 10s 内的按钮事件认为有效
  if (diff <= 10) {
    return {
      reason: '床头一键报警长按触发',
      context: { pressedAt: lastButton, ageSec: diff },
    };
  }
  return null;
}

/** R-MIX-01: 夜间离床 >= 30min + 厕所 PIR 有人 */
function evalMix01(
  state: Record<string, string>,
  ctx: ElderContext,
  now: dayjs.Dayjs
): ReturnType<typeof evaluateRule> {
  if (!isNightTime(now)) return null;
  if (state['in_bed'] !== '0') return null;

  const offBedSince = state['off_bed_since'];
  if (!offBedSince) return null;

  const offBedMin = now.diff(dayjs(offBedSince), 'minute');
  const thresholdMin = ctx.habitProfile.bedLeaveMin || 30;

  if (offBedMin < thresholdMin) return null;

  // 检查卫生间 PIR 是否 active
  const bathroomActive = state['pir_bathroom'] === '1' || state['pir_卫生间'] === '1';
  if (!bathroomActive) return null;

  return {
    reason: `夜间离床已 ${offBedMin} 分钟，厕所 PIR 持续有人`,
    context: { offBedMin, bathroomActive: true, threshold: thresholdMin },
  };
}

/** R-MIX-02: 应睡未睡 + 未出门 + 厕所无人 */
function evalMix02(
  state: Record<string, string>,
  ctx: ElderContext,
  now: dayjs.Dayjs
): ReturnType<typeof evaluateRule> {
  if (!isPastSleepDeadline(ctx, now)) return null;
  if (state['in_bed'] === '1') return null;

  // 检查近期是否有开门
  const lastDoorOpen = state['last_door_open'];
  if (lastDoorOpen) {
    const doorOpenMin = now.diff(dayjs(lastDoorOpen), 'minute');
    if (doorOpenMin < 60) return null; // 1h 内有开门则排除
  }

  // 厕所无人
  const bathroomActive = state['pir_bathroom'] === '1' || state['pir_卫生间'] === '1';
  if (bathroomActive) return null;

  const deadline = getSleepDeadline(ctx);
  return {
    reason: `超过就寝时间(${deadline})仍未上床，门未开，厕所无人`,
    context: { sleepDeadline: deadline, inBed: false, doorRecent: false },
  };
}

/** R-BED-01: 夜间离床超时 */
function evalBed01(
  state: Record<string, string>,
  ctx: ElderContext,
  now: dayjs.Dayjs
): ReturnType<typeof evaluateRule> {
  if (!isNightTime(now)) return null;
  if (state['in_bed'] !== '0') return null;

  const offBedSince = state['off_bed_since'];
  if (!offBedSince) return null;

  const offBedMin = now.diff(dayjs(offBedSince), 'minute');
  const thresholdMin = ctx.habitProfile.bedLeaveMin || 30;

  if (offBedMin < thresholdMin) return null;

  // 排除：厕所 PIR 有人（那是 R-MIX-01）
  const bathroomActive = state['pir_bathroom'] === '1' || state['pir_卫生间'] === '1';
  if (bathroomActive) return null;

  return {
    reason: `夜间离床已 ${offBedMin} 分钟，厕所无人`,
    context: { offBedMin, threshold: thresholdMin },
  };
}

/** R-BED-02: 应睡未睡 */
function evalBed02(
  state: Record<string, string>,
  ctx: ElderContext,
  now: dayjs.Dayjs
): ReturnType<typeof evaluateRule> {
  if (!isPastSleepDeadline(ctx, now)) return null;
  if (state['in_bed'] === '1') return null;

  const deadline = getSleepDeadline(ctx);
  return {
    reason: `超过就寝时间(${deadline})仍未上床`,
    context: { sleepDeadline: deadline },
  };
}

/** R-BED-03: 整夜在床 < 1h (22:00-06:00) — 事件窗口聚合 */
function evalBed03(
  state: Record<string, string>,
  _ctx: ElderContext,
  now: dayjs.Dayjs
): ReturnType<typeof evaluateRule> {
  // 仅在早上 06:00-07:00 窗口评估
  const hour = now.hour();
  if (hour < 6 || hour > 7) return null;

  // 从 state 里读取预计算的累计在床分钟数
  // 由 computeBedAccum 在 ingestEvent 后写入
  const accumStr = state['bed_accum_night_min'];
  const accumMin = accumStr ? Number(accumStr) : 0;

  if (accumMin >= 60) return null; // 在床 >= 1h 则正常

  return {
    reason: `整夜在床累计仅 ${accumMin} 分钟（阈值 60 分钟）`,
    context: { inBedAccumMin: accumMin, threshold: 60 },
  };
}

/**
 * 计算 22:00-06:00 累计在床时间并写入 state Hash
 * 应在 ingestEvent(off_bed/on_bed) 后调用
 */
export async function computeBedAccum(elderId: string): Promise<number> {
  const evtKey = RedisKeys.events(elderId);
  const stateKey = RedisKeys.state(elderId);
  const now = dayjs();

  // 确定昨晚 22:00 到今早 06:00 的时间窗口
  let windowStart: dayjs.Dayjs;
  let windowEnd: dayjs.Dayjs;

  if (now.hour() >= 22) {
    // 如果现在是 22 点后，窗口还没结束
    windowStart = now.clone().hour(22).minute(0).second(0);
    windowEnd = now; // 当前时刻
  } else {
    // 早上评估：昨晚 22:00 到今早 06:00
    windowStart = now.clone().subtract(1, 'day').hour(22).minute(0).second(0);
    windowEnd = now.clone().hour(6).minute(0).second(0);
  }

  // 取事件列表（最新在前）
  const rawEvents = await redis.lrange(evtKey, 0, -1);

  // 筛选窗口内的 on_bed / off_bed 事件
  const bedEvents: Array<{ type: 'on' | 'off'; ts: dayjs.Dayjs }> = [];
  for (const raw of rawEvents) {
    try {
      const evt = JSON.parse(raw) as { eventType: string; ts: string };
      const evtTime = dayjs(evt.ts);
      if (evtTime.isBefore(windowStart) || evtTime.isAfter(windowEnd)) continue;
      if (evt.eventType === 'on_bed') bedEvents.push({ type: 'on', ts: evtTime });
      else if (evt.eventType === 'off_bed') bedEvents.push({ type: 'off', ts: evtTime });
    } catch { /* skip malformed */ }
  }

  // 按时间正序
  bedEvents.sort((a, b) => a.ts.valueOf() - b.ts.valueOf());

  // 累计在床分钟
  let accumMin = 0;
  let lastOnTime: dayjs.Dayjs | null = null;

  for (const evt of bedEvents) {
    if (evt.type === 'on') {
      lastOnTime = evt.ts;
    } else if (evt.type === 'off' && lastOnTime) {
      accumMin += evt.ts.diff(lastOnTime, 'minute');
      lastOnTime = null;
    }
  }

  // 如果最后一次 on_bed 还没 off，算到窗口结束
  if (lastOnTime) {
    accumMin += windowEnd.diff(lastOnTime, 'minute');
  }

  // 写入 state
  await redis.hset(stateKey, 'bed_accum_night_min', String(accumMin));

  return accumMin;
}

/** R-BED-04: 连续在床 > 12h */
function evalBed04(
  state: Record<string, string>,
  now: dayjs.Dayjs
): ReturnType<typeof evaluateRule> {
  if (state['in_bed'] !== '1') return null;

  const inBedSince = state['in_bed_since'];
  if (!inBedSince) return null;

  const inBedMin = now.diff(dayjs(inBedSince), 'minute');
  if (inBedMin < 720) return null; // < 12h

  return {
    reason: `连续在床已 ${Math.floor(inBedMin / 60)} 小时`,
    context: { inBedMin, thresholdMin: 720 },
  };
}

/** R-BATH-01: 卫生间滞留 */
function evalBath01(
  state: Record<string, string>,
  ctx: ElderContext,
  now: dayjs.Dayjs
): ReturnType<typeof evaluateRule> {
  const bathroomActive = state['pir_bathroom'] === '1' || state['pir_卫生间'] === '1';
  if (!bathroomActive) return null;

  const pirSince = state['pir_bathroom_since'] || state['pir_卫生间_since'];
  if (!pirSince) return null;

  const durationMin = now.diff(dayjs(pirSince), 'minute');

  // 冷启动: 安装 7 天内使用 60min 阈值
  let thresholdMin = ctx.habitProfile.bathThresholdMin || 30;
  if (ctx.habitProfile.installDays < 7) {
    thresholdMin = 60;
  }

  if (durationMin < thresholdMin) return null;

  return {
    reason: `卫生间滞留已 ${durationMin} 分钟`,
    context: { durationMin, threshold: thresholdMin, coldStart: ctx.habitProfile.installDays < 7 },
  };
}

/** R-DOOR-01: 72h 未出门 */
function evalDoor01(
  state: Record<string, string>,
  ctx: ElderContext,
  now: dayjs.Dayjs
): ReturnType<typeof evaluateRule> {
  // homebound 时关闭此规则
  if (ctx.isHomebound) return null;

  const lastDoorOpen = state['last_door_open'];
  if (!lastDoorOpen) {
    return {
      reason: '无开门记录',
      context: { absenceHours: null },
    };
  }

  const absenceHours = now.diff(dayjs(lastDoorOpen), 'hour');
  if (absenceHours < 72) return null;

  return {
    reason: `已 ${absenceHours} 小时未出门`,
    context: { absenceHours, lastDoorOpen },
  };
}

/** R-DOOR-02: 门长开 >= 30min */
function evalDoor02(
  state: Record<string, string>,
  now: dayjs.Dayjs
): ReturnType<typeof evaluateRule> {
  if (state['door_open'] !== '1') return null;

  const doorOpenSince = state['door_open_since'];
  if (!doorOpenSince) return null;

  const durationMin = now.diff(dayjs(doorOpenSince), 'minute');
  if (durationMin < 30) return null;

  return {
    reason: `入户门持续打开已 ${durationMin} 分钟`,
    context: { durationMin, threshold: 30 },
  };
}

/** R-DEV-01: 24h 无事件 */
function evalDev01(
  state: Record<string, string>,
  now: dayjs.Dayjs
): ReturnType<typeof evaluateRule> {
  const lastEvent = state['last_event'];
  if (!lastEvent) {
    return {
      reason: '从未收到设备事件',
      context: { absenceHours: null },
    };
  }

  const absenceHours = now.diff(dayjs(lastEvent), 'hour');
  if (absenceHours < 24) return null;

  return {
    reason: `已 ${absenceHours} 小时无设备事件`,
    context: { absenceHours, lastEvent },
  };
}

/** R-DEV-02: 电量 < 20% */
function evalDev02(
  state: Record<string, string>
): ReturnType<typeof evaluateRule> {
  const batteryStr = state['battery_pct'];
  if (!batteryStr) return null;

  const battery = Number(batteryStr);
  if (isNaN(battery) || battery >= 20) return null;

  return {
    reason: `设备电量低: ${battery}%`,
    context: { batteryPct: battery, threshold: 20 },
  };
}

// ─── 辅助函数 ───

/** 判断是否夜间 19:00-07:00 */
function isNightTime(now: dayjs.Dayjs): boolean {
  const hour = now.hour();
  return hour >= 19 || hour < 7;
}

/** 获取就寝截止时间 HH:MM */
function getSleepDeadline(ctx: ElderContext): string {
  const tSleep = ctx.habitProfile.tSleep || '22:00';
  const delta = ctx.habitProfile.deltaMin || 90;
  const [h, m] = tSleep.split(':').map(Number);
  const deadline = dayjs().hour(h).minute(m).add(delta, 'minute');
  return deadline.format('HH:mm');
}

/** 判断是否超过就寝截止时间 */
function isPastSleepDeadline(ctx: ElderContext, now: dayjs.Dayjs): boolean {
  const tSleep = ctx.habitProfile.tSleep || '22:00';
  const delta = ctx.habitProfile.deltaMin || 90;
  const [h, m] = tSleep.split(':').map(Number);
  const deadline = now.clone().hour(h).minute(m).second(0).add(delta, 'minute');

  // 如果截止时间跨天（如 23:30 + 90min = 01:00），需要处理
  if (deadline.isBefore(now.clone().hour(h).minute(m))) {
    // 已经过了午夜
    return now.isAfter(deadline);
  }

  return now.isAfter(deadline);
}

// ─── 主流程 ───

/**
 * 完整的告警评估管线：
 * evaluate → applySuppression → applyDedup
 */
export async function pipeline(
  elderId: string,
  ctx: ElderContext
): Promise<AlertCandidate[]> {
  // 1. 检查有效状态（窗口过期自动恢复）
  const effectiveStatus = getEffectiveStatus(ctx);
  const effectiveCtx = { ...ctx, status: effectiveStatus };

  // 2. 评估所有规则
  const candidates = await evaluate(elderId, effectiveCtx);
  if (candidates.length === 0) return [];

  // 3. 状态抑制
  const afterSuppression = applySuppression(candidates, effectiveCtx);

  // 4. 去重
  const afterDedup = await applyDedup(afterSuppression, elderId);

  return afterDedup;
}

// 导出子模块供外部引用
export { applySuppression } from './status-guard.js';
export { applyDedup } from './dedup.js';
