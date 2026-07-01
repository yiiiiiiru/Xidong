/**
 * 双呼升级调度器
 *
 * 对齐系统设计 §7.2:
 *   parallel_call([worker.phone, property.phone])
 *   on_timeout(60s) → escalate(backup + supervisor)
 *   round >= 3 → @all + director
 *   fallback: DING + 卡片 + 短信
 *
 * Redis Key: escalation:{alertId} Hash { round, started_at, last_call_at, status }
 *
 * @module services/escalation
 */

import redis from '../db/redis.js';
import { initiateVoiceCall, sendInteractiveCard } from './dingtalk.js';
import { notifyAlert } from './notify.js';
import { WorkerDao } from '../db/dao.js';

const CALL_TIMEOUT_SEC = Number(process.env.ESCALATION_TIMEOUT_SEC) || 60;
const MAX_ROUNDS = Number(process.env.ESCALATION_MAX_ROUNDS) || 3;

export interface EscalationContext {
  alertId: string;
  elderId: string;
  elderName: string;
  building: string;
  room: string;
  ruleId: string;
  level: 'P0' | 'P1' | 'P2';
  triggerDesc: string;
  triggeredAt: string;
}

/**
 * 启动升级调度（P0 告警触发时调用）
 */
export async function startEscalation(ctx: EscalationContext): Promise<void> {
  const key = `escalation:${ctx.alertId}`;

  // 已在升级中则跳过
  const existing = await redis.hget(key, 'status');
  if (existing === 'active') return;

  // 初始化升级状态
  await redis.hset(key, {
    round: '1',
    started_at: new Date().toISOString(),
    last_call_at: new Date().toISOString(),
    status: 'active',
  });
  await redis.expire(key, 24 * 3600); // 24h TTL

  // 执行第一轮
  await executeRound(ctx, 1);
}

/**
 * 执行某一轮双呼
 */
async function executeRound(ctx: EscalationContext, round: number): Promise<void> {
  console.log(`[Escalation] round ${round} for alert ${ctx.alertId}`);

  if (round >= MAX_ROUNDS) {
    // 第 3 轮: @all + director
    await escalateToDirector(ctx);
    return;
  }

  // 获取当班社工 + 物业电话
  const targets = await getCallTargets(ctx, round);

  // 并行双呼
  for (const target of targets) {
    await initiateVoiceCall({
      callerPhone: target.phone,
      calleePhone: target.phone, // ponytail: 双呼实际是平台拨出，两端都是被叫
      alertId: ctx.alertId,
    });
  }

  // 同时推送卡片
  const cardUserIds = targets.map(t => t.dingtalkUserId).filter(Boolean);
  if (cardUserIds.length) {
    await sendInteractiveCard({
      outTrackId: ctx.alertId,
      userIdList: cardUserIds,
      title: `🔴 [P0] ${ctx.elderName} - ${ctx.triggerDesc}`,
      markdown: [
        `### 紧急告警`,
        `**老人**: ${ctx.elderName}`,
        `**位置**: ${ctx.building}栋${ctx.room}`,
        `**规则**: ${ctx.ruleId}`,
        `**描述**: ${ctx.triggerDesc}`,
      ].join('\n'),
      btns: [
        { title: '立即接单', actionURL: `dingtalk://callback?alertId=${ctx.alertId}&action=acknowledge` },
        { title: '误报关闭', actionURL: `dingtalk://callback?alertId=${ctx.alertId}&action=false_positive` },
      ],
    });
  }

  // 记录本轮
  const key = `escalation:${ctx.alertId}`;
  await redis.hset(key, 'last_call_at', new Date().toISOString(), 'round', String(round));

  // 设置超时检查（由外部定时任务触发 checkEscalationTimeout）
  // ponytail: MVP 不做真实定时器，由 simulate 脚本或 cron 检查
}

/**
 * 超时检查 — 由定时任务每 30s 调用
 */
export async function checkEscalationTimeout(alertId: string, ctx: EscalationContext): Promise<void> {
  const key = `escalation:${alertId}`;
  const state = await redis.hgetall(key);

  if (state.status !== 'active') return;

  const lastCallAt = new Date(state.last_call_at).getTime();
  const elapsed = (Date.now() - lastCallAt) / 1000;

  if (elapsed < CALL_TIMEOUT_SEC) return;

  const currentRound = Number(state.round) || 1;
  const nextRound = currentRound + 1;

  console.log(`[Escalation] timeout on round ${currentRound}, escalating to round ${nextRound}`);
  await executeRound(ctx, nextRound);
}

/**
 * 停止升级（告警被处置后调用）
 */
export async function cancelEscalation(alertId: string): Promise<void> {
  const key = `escalation:${alertId}`;
  await redis.hset(key, 'status', 'resolved');
}

// ─── 内部 ───

async function getCallTargets(ctx: EscalationContext, round: number): Promise<Array<{ phone: string; dingtalkUserId: string }>> {
  const targets: Array<{ phone: string; dingtalkUserId: string }> = [];

  if (round === 1) {
    // 第 1 轮: 当班社工 + 物业
    const { items: workers } = await WorkerDao.findAll({ role: 'social_worker', page: 1, pageSize: 10 });
    const onDuty = workers.filter(w => w.on_duty === 1);
    for (const w of onDuty) {
      targets.push({ phone: w.phone || '', dingtalkUserId: w.dingtalk_user_id || '' });
    }
  } else {
    // 第 2 轮: 备班 + 主管
    const { items: backups } = await WorkerDao.findAll({ role: 'backup', page: 1, pageSize: 10 });
    for (const w of backups) {
      targets.push({ phone: w.phone || '', dingtalkUserId: w.dingtalk_user_id || '' });
    }
  }

  return targets;
}

async function escalateToDirector(ctx: EscalationContext): Promise<void> {
  console.log(`[Escalation] MAX ROUNDS reached for ${ctx.alertId}, notifying director`);

  // 通知所有人 + director
  const { items: directors } = await WorkerDao.findAll({ role: 'director', page: 1, pageSize: 5 });
  const directorIds = directors.map(d => d.dingtalk_user_id || '').filter(Boolean);

  if (directorIds.length) {
    await sendInteractiveCard({
      outTrackId: ctx.alertId,
      userIdList: directorIds,
      title: `🚨 [升级] ${ctx.elderName} 告警无人响应`,
      markdown: `### 告警升级 — 第 ${MAX_ROUNDS} 轮无人接单\n\n**老人**: ${ctx.elderName}\n**描述**: ${ctx.triggerDesc}\n\n请立即处理！`,
      btns: [
        { title: '查看详情', actionURL: `dingtalk://callback?alertId=${ctx.alertId}&action=acknowledge` },
      ],
    });
  }

  // Fallback: 群机器人
  await notifyAlert({
    alertId: ctx.alertId,
    elderName: ctx.elderName,
    building: ctx.building,
    room: ctx.room,
    ruleId: ctx.ruleId,
    level: ctx.level,
    triggerDesc: `[升级] ${ctx.triggerDesc} — 连续 ${MAX_ROUNDS} 轮无人响应`,
    triggeredAt: ctx.triggeredAt,
  });

  // 标记升级完成
  const key = `escalation:${ctx.alertId}`;
  await redis.hset(key, 'status', 'escalated_max');
}
