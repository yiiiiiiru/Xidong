/**
 * Dedup 去重逻辑单元测试
 *
 * Mock Redis，验证：
 * - 首次告警通过
 * - 5min 内重复被抑制
 * - R-BTN (skipDedup) 始终通过
 * - 已被 suppressed 的候选直接保留
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/db/redis.js', () => ({
  default: {
    set: vi.fn(),
    del: vi.fn(),
  },
  RedisKeys: {
    dedup: (elderId: string, level: string, ruleId: string) =>
      `dedup:${elderId}:${level}:${ruleId}`,
  },
}));

import { applyDedup } from '../../src/rules/dedup.js';
import redis from '../../src/db/redis.js';
import type { AlertCandidate } from '../../src/types/index.js';

const mockedRedis = vi.mocked(redis);

beforeEach(() => {
  vi.clearAllMocks();
});

function makeCandidate(overrides: Partial<AlertCandidate> = {}): AlertCandidate {
  return {
    ruleId: 'R-BED-01',
    level: 'P1',
    elderId: 'E001',
    reason: '夜间离床',
    context: {},
    ...overrides,
  };
}

describe('applyDedup', () => {
  it('首次告警通过（SET NX 返回 OK）', async () => {
    mockedRedis.set.mockResolvedValue('OK' as any);

    const candidates = [makeCandidate()];
    const result = await applyDedup(candidates, 'E001');

    expect(result).toHaveLength(1);
    expect(result[0].suppressed).toBeUndefined();
    expect(mockedRedis.set).toHaveBeenCalledWith(
      'dedup:E001:P1:R-BED-01',
      '1',
      'EX',
      300,
      'NX'
    );
  });

  it('5min 内重复被抑制（SET NX 返回 null）', async () => {
    mockedRedis.set.mockResolvedValue(null as any);

    const candidates = [makeCandidate()];
    const result = await applyDedup(candidates, 'E001');

    expect(result).toHaveLength(1);
    expect(result[0].suppressed).toBe(true);
    expect(result[0].suppressReason).toBe('priority');
  });

  it('R-BTN (skipDedup=true) 始终通过，不调用 Redis', async () => {
    const candidates = [makeCandidate({ ruleId: 'R-BTN', level: 'P0' })];
    const result = await applyDedup(candidates, 'E001');

    expect(result).toHaveLength(1);
    expect(result[0].suppressed).toBeUndefined();
    expect(mockedRedis.set).not.toHaveBeenCalled();
  });

  it('已被 suppressed 的候选直接保留，不做去重检查', async () => {
    const candidates = [
      makeCandidate({ suppressed: true, suppressReason: 'away' }),
    ];
    const result = await applyDedup(candidates, 'E001');

    expect(result).toHaveLength(1);
    expect(result[0].suppressed).toBe(true);
    expect(result[0].suppressReason).toBe('away');
    expect(mockedRedis.set).not.toHaveBeenCalled();
  });

  it('混合场景：多条候选分别处理', async () => {
    // 第一条 OK，第二条 null（重复），第三条 skipDedup
    mockedRedis.set
      .mockResolvedValueOnce('OK' as any)
      .mockResolvedValueOnce(null as any);

    const candidates = [
      makeCandidate({ ruleId: 'R-BED-01', level: 'P1' }),
      makeCandidate({ ruleId: 'R-DOOR-01', level: 'P2' }),
      makeCandidate({ ruleId: 'R-BTN', level: 'P0' }),
    ];

    const result = await applyDedup(candidates, 'E001');

    expect(result).toHaveLength(3);
    expect(result[0].suppressed).toBeUndefined(); // 通过
    expect(result[1].suppressed).toBe(true);       // 重复
    expect(result[2].suppressed).toBeUndefined(); // skipDedup
  });
});
