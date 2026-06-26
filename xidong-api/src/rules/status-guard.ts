/**
 * StatusGuard — 状态抑制守卫
 *
 * 根据老人当前状态（外出/住院/暂停）抑制告警。
 * R-BTN 永不抑制（penetrateSuppress = true）。
 *
 * @module rules/status-guard
 */

import type { AlertCandidate, ElderContext, SuppressReason } from '../types/index.js';
import rulesConfig from './rules.json' with { type: 'json' };

interface RuleJsonItem {
  id: string;
  penetrateSuppress?: boolean;
}

const rulesMap = new Map<string, RuleJsonItem>(
  (rulesConfig as RuleJsonItem[]).map((r) => [r.id, r])
);

/**
 * 对候选告警列表执行状态抑制。
 *
 * 逻辑：
 * 1. 老人状态为 home → 不抑制任何告警
 * 2. 老人状态为 away/hospital/paused → 抑制所有告警
 * 3. 但 penetrateSuppress=true 的规则（R-BTN）穿透抑制
 *
 * @param candidates - 待评估告警候选列表
 * @param ctx        - 老人上下文（含当前状态）
 * @returns          - 标记过 suppressed/suppressReason 的告警列表
 */
export function applySuppression(
  candidates: AlertCandidate[],
  ctx: ElderContext
): AlertCandidate[] {
  // 在家状态不做抑制
  if (ctx.status === 'home') {
    return candidates;
  }

  const suppressReason: SuppressReason = mapStatusToReason(ctx.status);

  return candidates.map((candidate) => {
    const ruleCfg = rulesMap.get(candidate.ruleId);

    // 穿透抑制（如 R-BTN）
    if (ruleCfg?.penetrateSuppress) {
      return candidate;
    }

    return {
      ...candidate,
      suppressed: true,
      suppressReason,
    };
  });
}

/**
 * 检查老人状态是否在有效期内。
 * 如果 statusWindow.end 已过，返回 'home' 表示状态窗口过期。
 */
export function getEffectiveStatus(ctx: ElderContext, now: Date = new Date()): ElderContext['status'] {
  if (ctx.status === 'home') return 'home';

  // 检查状态窗口是否过期
  if (ctx.statusWindow?.end && now > ctx.statusWindow.end) {
    return 'home';
  }

  return ctx.status;
}

/**
 * 将老人状态映射到抑制原因
 */
function mapStatusToReason(status: ElderContext['status']): SuppressReason {
  const map: Record<string, SuppressReason> = {
    away: 'away',
    hospital: 'hospital',
    paused: 'paused',
  };
  return map[status] || 'away';
}
