/**
 * DedupService — 告警去重
 *
 * 5min 内同一 elderId + level + ruleId 的告警视为重复。
 * R-BTN（skipDedup=true）豁免去重。
 *
 * 使用 Redis SET NX EX 实现分布式去重。
 *
 * @module rules/dedup
 */

import type { AlertCandidate } from '../types/index.js';
import redis, { RedisKeys } from '../db/redis.js';
import rulesConfig from './rules.json' with { type: 'json' };

interface RuleJsonItem {
  id: string;
  skipDedup?: boolean;
}

const DEDUP_TTL_SEC = 300; // 5 minutes

const rulesMap = new Map<string, RuleJsonItem>(
  (rulesConfig as RuleJsonItem[]).map((r) => [r.id, r])
);

/**
 * 对候选告警列表执行去重。
 *
 * 已被抑制（suppressed=true）的告警跳过去重检查。
 * skipDedup=true 的规则（R-BTN）直接通过。
 * 其余检查 Redis: dedup:{elderId}:{level}:{ruleId}
 *   - 不存在 → SET NX EX 300 → 通过
 *   - 已存在 → 标记 suppressed + reason='priority'
 *
 * @param candidates - 经过状态抑制后的候选列表
 * @param elderId    - 当前老人 ID
 * @returns          - 去重后的告警列表
 */
export async function applyDedup(
  candidates: AlertCandidate[],
  elderId: string
): Promise<AlertCandidate[]> {
  const results: AlertCandidate[] = [];

  for (const candidate of candidates) {
    // 已被抑制的直接保留（不重复处理）
    if (candidate.suppressed) {
      results.push(candidate);
      continue;
    }

    // 检查规则是否豁免去重
    const ruleCfg = rulesMap.get(candidate.ruleId);
    if (ruleCfg?.skipDedup) {
      results.push(candidate);
      continue;
    }

    // Redis 去重检查
    const dedupKey = RedisKeys.dedup(elderId, candidate.level, candidate.ruleId);
    const wasSet = await redis.set(dedupKey, '1', 'EX', DEDUP_TTL_SEC, 'NX');

    if (wasSet) {
      // 首次出现 → 通过
      results.push(candidate);
    } else {
      // 5min 内重复 → 抑制
      results.push({
        ...candidate,
        suppressed: true,
        suppressReason: 'priority',
      });
    }
  }

  return results;
}

/**
 * 清除指定老人的去重标记（用于测试或手动重置）
 */
export async function clearDedup(
  elderId: string,
  level: string,
  ruleId: string
): Promise<void> {
  const key = RedisKeys.dedup(elderId, level, ruleId);
  await redis.del(key);
}
