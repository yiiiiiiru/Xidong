/**
 * 钉钉通知推送服务
 *
 * 支持两种推送方式：
 * 1. 群机器人 Webhook（P0/P1 告警 → 工作群）
 * 2. 工作通知（个人推送 → 责任社工）
 *
 * MVP 阶段使用群机器人，W2 升级为互动卡片
 */

import type { AlertLevel } from '../types/index.js';

// ─── 配置 ───

const DINGTALK_WEBHOOK = process.env.DINGTALK_WEBHOOK || '';
const DINGTALK_SECRET = process.env.DINGTALK_SECRET || '';
const NOTIFY_ENABLED = process.env.NOTIFY_ENABLED !== 'false';

// ─── 告警消息结构 ───

export interface AlertNotifyPayload {
  alertId: string;
  elderName: string;
  building: string;
  room: string;
  ruleId: string;
  level: AlertLevel;
  triggerDesc: string;
  triggeredAt: string;
}

// ─── 推送入口 ───

export async function notifyAlert(payload: AlertNotifyPayload): Promise<boolean> {
  if (!NOTIFY_ENABLED) {
    console.log(`[Notify] disabled, skip: ${payload.ruleId} (${payload.level})`);
    return false;
  }

  // ponytail: P1 夜间勿扰 23:00-06:00，仅 P0 穿透；升级路径：Redis 配置化勿扰时段
  if (payload.level === 'P1') {
    const hour = new Date().getHours();
    if (hour >= 23 || hour < 6) {
      console.log(`[Notify] quiet hours (23-06), suppress P1: ${payload.ruleId}`);
      return false;
    }
  }

  if (!DINGTALK_WEBHOOK) {
    console.warn('[Notify] DINGTALK_WEBHOOK not configured, logging only');
    logAlert(payload);
    return false;
  }

  try {
    const markdown = buildMarkdown(payload);
    await sendDingtalkRobot(markdown.title, markdown.text);
    console.log(`[Notify] sent: ${payload.ruleId} → ${payload.elderName}`);
    return true;
  } catch (err) {
    console.error('[Notify] send failed:', (err as Error).message);
    return false;
  }
}

// ─── 构建 Markdown 消息 ───

function buildMarkdown(p: AlertNotifyPayload): { title: string; text: string } {
  const levelEmoji: Record<AlertLevel, string> = {
    P0: '🔴',
    P1: '🟡',
    P2: '🔵',
  };

  const levelLabel: Record<AlertLevel, string> = {
    P0: '紧急',
    P1: '重要',
    P2: '提示',
  };

  const title = `${levelEmoji[p.level]} [${levelLabel[p.level]}] ${p.elderName} - ${p.triggerDesc}`;

  const text = [
    `### ${title}`,
    '',
    `**老人**: ${p.elderName}`,
    `**位置**: ${p.building}栋${p.room}`,
    `**规则**: ${p.ruleId}`,
    `**等级**: ${p.level} (${levelLabel[p.level]})`,
    `**描述**: ${p.triggerDesc}`,
    `**时间**: ${p.triggeredAt}`,
    '',
    `> 告警ID: ${p.alertId}`,
    '',
    `[查看详情](dingtalk://dingtalkclient/page/link?url=${encodeURIComponent(`/alert/${p.alertId}`)})`,
  ].join('\n');

  return { title, text };
}

// ─── 钉钉机器人 Webhook ───

async function sendDingtalkRobot(title: string, markdownText: string): Promise<void> {
  const url = buildSignedUrl(DINGTALK_WEBHOOK, DINGTALK_SECRET);

  const body = {
    msgtype: 'markdown',
    markdown: { title, text: markdownText },
    at: { isAtAll: false },
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    throw new Error(`DingTalk API error: ${resp.status} ${await resp.text()}`);
  }

  const result = await resp.json() as { errcode: number; errmsg: string };
  if (result.errcode !== 0) {
    throw new Error(`DingTalk biz error: ${result.errcode} ${result.errmsg}`);
  }
}

// ─── 签名计算 ───

function buildSignedUrl(webhook: string, secret: string): string {
  if (!secret) return webhook;

  const timestamp = Date.now();
  const stringToSign = `${timestamp}\n${secret}`;

  // Node.js 原生 crypto
  const crypto = globalThis.crypto || require('node:crypto');
  const hmac = require('node:crypto').createHmac('sha256', secret);
  hmac.update(stringToSign);
  const sign = encodeURIComponent(hmac.digest('base64'));

  return `${webhook}&timestamp=${timestamp}&sign=${sign}`;
}

// ─── 降级：仅日志 ───

function logAlert(p: AlertNotifyPayload): void {
  console.log(`[Notify][LOG] ${p.level} | ${p.elderName} | ${p.building}栋${p.room} | ${p.ruleId} | ${p.triggerDesc}`);
}

// ─── 批量推送（告警升级时调用）───

export async function notifyEscalation(
  payload: AlertNotifyPayload,
  phones: string[]
): Promise<boolean> {
  if (!NOTIFY_ENABLED || !DINGTALK_WEBHOOK) {
    console.log(`[Notify] escalation skip: ${payload.alertId}`);
    return false;
  }

  const markdown = buildMarkdown(payload);
  const escalationText = markdown.text + `\n\n**⚠️ 升级通知**: 此告警已超时未处理，@${phones.join(' @')}`;

  try {
    const url = buildSignedUrl(DINGTALK_WEBHOOK, DINGTALK_SECRET);
    const body = {
      msgtype: 'markdown',
      markdown: { title: `⚠️升级: ${markdown.title}`, text: escalationText },
      at: { atMobiles: phones, isAtAll: false },
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    return resp.ok;
  } catch (err) {
    console.error('[Notify] escalation failed:', (err as Error).message);
    return false;
  }
}
