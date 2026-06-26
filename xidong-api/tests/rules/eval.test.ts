/**
 * 规则引擎 eval 函数单测
 *
 * Mock Redis hgetall 返回指定 state，验证各规则的判定逻辑。
 * 每条规则至少 3 个用例：触发 / 不触发 / 边界条件。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import dayjs from 'dayjs';

// Mock Redis
vi.mock('../../src/db/redis.js', () => ({
  default: {
    hgetall: vi.fn(),
    lpush: vi.fn(),
    ltrim: vi.fn(),
    expire: vi.fn(),
    hset: vi.fn(),
    lrange: vi.fn().mockResolvedValue([]),
  },
  RedisKeys: {
    events: (id: string) => `evt:${id}`,
    state: (id: string) => `state:${id}`,
    dedup: (id: string, lvl: string, rule: string) => `dedup:${id}:${lvl}:${rule}`,
    falsePositive: (id: string, rule: string) => `fp:${id}:${rule}`,
  },
}));

// Mock dedup — 让所有候选通过
vi.mock('../../src/rules/dedup.js', () => ({
  applyDedup: vi.fn(async (candidates: unknown[]) => candidates),
}));

import { evaluate } from '../../src/rules/engine.js';
import redis from '../../src/db/redis.js';
import type { ElderContext } from '../../src/types/index.js';

const mockedRedis = vi.mocked(redis);

function makeCtx(overrides: Partial<ElderContext> = {}): ElderContext {
  return {
    id: 'E001',
    name: '测试老人',
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
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── R-BTN ───

describe('R-BTN 按键报警', () => {
  it('10s 内有 button 事件 → 触发 P0', async () => {
    const now = dayjs('2026-06-25T14:00:00+08:00');
    vi.setSystemTime(now.toDate());
    mockedRedis.hgetall.mockResolvedValue({
      last_button: now.subtract(5, 'second').toISOString(),
    });

    const candidates = await evaluate('E001', makeCtx({ planLevel: 'basic' }));
    const btn = candidates.find(c => c.ruleId === 'R-BTN');
    expect(btn).toBeDefined();
    expect(btn!.level).toBe('P0');
    vi.useRealTimers();
  });

  it('无 last_button 不触发', async () => {
    const now = dayjs('2026-06-25T14:00:00+08:00');
    vi.setSystemTime(now.toDate());
    mockedRedis.hgetall.mockResolvedValue({});
    const candidates = await evaluate('E001', makeCtx());
    expect(candidates.find(c => c.ruleId === 'R-BTN')).toBeUndefined();
    vi.useRealTimers();
  });

  it('按键超过 10s 不触发', async () => {
    const now = dayjs('2026-06-25T14:00:00+08:00');
    vi.setSystemTime(now.toDate());
    mockedRedis.hgetall.mockResolvedValue({
      last_button: now.subtract(20, 'second').toISOString(),
    });
    const candidates = await evaluate('E001', makeCtx());
    expect(candidates.find(c => c.ruleId === 'R-BTN')).toBeUndefined();
    vi.useRealTimers();
  });
});

// ─── R-BED-01 ───

describe('R-BED-01 夜间离床超时', () => {
  it('夜间离床超阈值 + 厕所无人 → 触发', async () => {
    const now = dayjs('2026-06-25T02:00:00+08:00');
    mockedRedis.hgetall.mockResolvedValue({
      in_bed: '0',
      off_bed_since: now.subtract(40, 'minute').toISOString(),
      pir_bathroom: '0',
    });

    // 需要让 dayjs() 返回夜间时间 — evaluate 内部用 dayjs()
    vi.spyOn(dayjs, 'call' as never); // not needed, dayjs() uses real time
    // 改用直接 mock Date
    vi.setSystemTime(now.toDate());

    const candidates = await evaluate('E001', makeCtx());
    const bed01 = candidates.find(c => c.ruleId === 'R-BED-01');
    expect(bed01).toBeDefined();
    expect(bed01!.level).toBe('P1');

    vi.useRealTimers();
  });

  it('白天不触发', async () => {
    const now = dayjs('2026-06-25T10:00:00+08:00');
    vi.setSystemTime(now.toDate());
    mockedRedis.hgetall.mockResolvedValue({
      in_bed: '0',
      off_bed_since: now.subtract(40, 'minute').toISOString(),
    });

    const candidates = await evaluate('E001', makeCtx());
    expect(candidates.find(c => c.ruleId === 'R-BED-01')).toBeUndefined();
    vi.useRealTimers();
  });

  it('离床时间未到阈值不触发', async () => {
    const now = dayjs('2026-06-25T02:00:00+08:00');
    vi.setSystemTime(now.toDate());
    mockedRedis.hgetall.mockResolvedValue({
      in_bed: '0',
      off_bed_since: now.subtract(10, 'minute').toISOString(),
      pir_bathroom: '0',
    });

    const candidates = await evaluate('E001', makeCtx());
    expect(candidates.find(c => c.ruleId === 'R-BED-01')).toBeUndefined();
    vi.useRealTimers();
  });
});

// ─── R-BED-04 ───

describe('R-BED-04 连续在床 > 12h', () => {
  it('在床超过 12h → 触发', async () => {
    const now = dayjs('2026-06-25T22:00:00+08:00');
    vi.setSystemTime(now.toDate());
    mockedRedis.hgetall.mockResolvedValue({
      in_bed: '1',
      in_bed_since: now.subtract(13, 'hour').toISOString(),
    });

    const candidates = await evaluate('E001', makeCtx());
    const bed04 = candidates.find(c => c.ruleId === 'R-BED-04');
    expect(bed04).toBeDefined();
    expect(bed04!.reason).toContain('13');
    vi.useRealTimers();
  });

  it('在床不足 12h 不触发', async () => {
    const now = dayjs('2026-06-25T10:00:00+08:00');
    vi.setSystemTime(now.toDate());
    mockedRedis.hgetall.mockResolvedValue({
      in_bed: '1',
      in_bed_since: now.subtract(8, 'hour').toISOString(),
    });

    const candidates = await evaluate('E001', makeCtx());
    expect(candidates.find(c => c.ruleId === 'R-BED-04')).toBeUndefined();
    vi.useRealTimers();
  });

  it('不在床不触发', async () => {
    const now = dayjs('2026-06-25T10:00:00+08:00');
    vi.setSystemTime(now.toDate());
    mockedRedis.hgetall.mockResolvedValue({ in_bed: '0' });

    const candidates = await evaluate('E001', makeCtx());
    expect(candidates.find(c => c.ruleId === 'R-BED-04')).toBeUndefined();
    vi.useRealTimers();
  });
});

// ─── R-BATH-01 ───

describe('R-BATH-01 卫生间滞留', () => {
  it('卫生间 PIR 超阈值 → 触发', async () => {
    const now = dayjs('2026-06-25T14:00:00+08:00');
    vi.setSystemTime(now.toDate());
    mockedRedis.hgetall.mockResolvedValue({
      pir_bathroom: '1',
      pir_bathroom_since: now.subtract(35, 'minute').toISOString(),
    });

    const candidates = await evaluate('E001', makeCtx());
    const bath = candidates.find(c => c.ruleId === 'R-BATH-01');
    expect(bath).toBeDefined();
    expect(bath!.level).toBe('P1');
    vi.useRealTimers();
  });

  it('冷启动期（<7天）使用 60min 阈值', async () => {
    const now = dayjs('2026-06-25T14:00:00+08:00');
    vi.setSystemTime(now.toDate());
    mockedRedis.hgetall.mockResolvedValue({
      pir_bathroom: '1',
      pir_bathroom_since: now.subtract(45, 'minute').toISOString(),
    });

    // installDays < 7 → 阈值 60min，45min 不触发
    const candidates = await evaluate('E001', makeCtx({
      habitProfile: { tSleep: '22:00', deltaMin: 90, bedLeaveMin: 30, bathThresholdMin: 30, installDays: 3, baselineReady: false },
    }));
    expect(candidates.find(c => c.ruleId === 'R-BATH-01')).toBeUndefined();
    vi.useRealTimers();
  });

  it('PIR 不活跃不触发', async () => {
    const now = dayjs('2026-06-25T14:00:00+08:00');
    vi.setSystemTime(now.toDate());
    mockedRedis.hgetall.mockResolvedValue({ pir_bathroom: '0' });

    const candidates = await evaluate('E001', makeCtx());
    expect(candidates.find(c => c.ruleId === 'R-BATH-01')).toBeUndefined();
    vi.useRealTimers();
  });
});

// ─── R-DOOR-01 ───

describe('R-DOOR-01 72h未出门', () => {
  it('超过 72h 无开门 → 触发', async () => {
    const now = dayjs('2026-06-25T12:00:00+08:00');
    vi.setSystemTime(now.toDate());
    mockedRedis.hgetall.mockResolvedValue({
      last_door_open: now.subtract(80, 'hour').toISOString(),
    });

    const candidates = await evaluate('E001', makeCtx());
    const door01 = candidates.find(c => c.ruleId === 'R-DOOR-01');
    expect(door01).toBeDefined();
    expect(door01!.level).toBe('P2');
    vi.useRealTimers();
  });

  it('72h 内有开门不触发', async () => {
    const now = dayjs('2026-06-25T12:00:00+08:00');
    vi.setSystemTime(now.toDate());
    mockedRedis.hgetall.mockResolvedValue({
      last_door_open: now.subtract(24, 'hour').toISOString(),
    });

    const candidates = await evaluate('E001', makeCtx());
    expect(candidates.find(c => c.ruleId === 'R-DOOR-01')).toBeUndefined();
    vi.useRealTimers();
  });

  it('homebound 时关闭此规则', async () => {
    const now = dayjs('2026-06-25T12:00:00+08:00');
    vi.setSystemTime(now.toDate());
    mockedRedis.hgetall.mockResolvedValue({
      last_door_open: now.subtract(100, 'hour').toISOString(),
    });

    const candidates = await evaluate('E001', makeCtx({ isHomebound: true }));
    expect(candidates.find(c => c.ruleId === 'R-DOOR-01')).toBeUndefined();
    vi.useRealTimers();
  });
});

// ─── R-DOOR-02 ───

describe('R-DOOR-02 门长开 ≥ 30min', () => {
  it('门开超 30min → 触发', async () => {
    const now = dayjs('2026-06-25T14:00:00+08:00');
    vi.setSystemTime(now.toDate());
    mockedRedis.hgetall.mockResolvedValue({
      door_open: '1',
      door_open_since: now.subtract(35, 'minute').toISOString(),
    });

    const candidates = await evaluate('E001', makeCtx());
    const door02 = candidates.find(c => c.ruleId === 'R-DOOR-02');
    expect(door02).toBeDefined();
    vi.useRealTimers();
  });

  it('门开不足 30min 不触发', async () => {
    const now = dayjs('2026-06-25T14:00:00+08:00');
    vi.setSystemTime(now.toDate());
    mockedRedis.hgetall.mockResolvedValue({
      door_open: '1',
      door_open_since: now.subtract(15, 'minute').toISOString(),
    });

    const candidates = await evaluate('E001', makeCtx());
    expect(candidates.find(c => c.ruleId === 'R-DOOR-02')).toBeUndefined();
    vi.useRealTimers();
  });

  it('门关闭状态不触发', async () => {
    const now = dayjs('2026-06-25T14:00:00+08:00');
    vi.setSystemTime(now.toDate());
    mockedRedis.hgetall.mockResolvedValue({ door_open: '0' });

    const candidates = await evaluate('E001', makeCtx());
    expect(candidates.find(c => c.ruleId === 'R-DOOR-02')).toBeUndefined();
    vi.useRealTimers();
  });
});

// ─── R-DEV-01 ───

describe('R-DEV-01 24h无事件', () => {
  it('超过 24h 无事件 → 触发', async () => {
    const now = dayjs('2026-06-25T12:00:00+08:00');
    vi.setSystemTime(now.toDate());
    mockedRedis.hgetall.mockResolvedValue({
      last_event: now.subtract(30, 'hour').toISOString(),
    });

    const candidates = await evaluate('E001', makeCtx({ planLevel: 'basic' }));
    const dev01 = candidates.find(c => c.ruleId === 'R-DEV-01');
    expect(dev01).toBeDefined();
    expect(dev01!.level).toBe('P2');
    vi.useRealTimers();
  });

  it('24h 内有事件不触发', async () => {
    const now = dayjs('2026-06-25T12:00:00+08:00');
    vi.setSystemTime(now.toDate());
    mockedRedis.hgetall.mockResolvedValue({
      last_event: now.subtract(10, 'hour').toISOString(),
    });

    const candidates = await evaluate('E001', makeCtx());
    expect(candidates.find(c => c.ruleId === 'R-DEV-01')).toBeUndefined();
    vi.useRealTimers();
  });

  it('无 last_event 也触发（从未收到事件）', async () => {
    const now = dayjs('2026-06-25T12:00:00+08:00');
    vi.setSystemTime(now.toDate());
    mockedRedis.hgetall.mockResolvedValue({});

    const candidates = await evaluate('E001', makeCtx({ planLevel: 'basic' }));
    const dev01 = candidates.find(c => c.ruleId === 'R-DEV-01');
    expect(dev01).toBeDefined();
    vi.useRealTimers();
  });
});

// ─── R-DEV-02 ───

describe('R-DEV-02 电量低', () => {
  it('电量 < 20% → 触发', async () => {
    const now = dayjs('2026-06-25T12:00:00+08:00');
    vi.setSystemTime(now.toDate());
    mockedRedis.hgetall.mockResolvedValue({ battery_pct: '15' });

    const candidates = await evaluate('E001', makeCtx({ planLevel: 'basic' }));
    const dev02 = candidates.find(c => c.ruleId === 'R-DEV-02');
    expect(dev02).toBeDefined();
    expect(dev02!.reason).toContain('15%');
    vi.useRealTimers();
  });

  it('电量 >= 20% 不触发', async () => {
    const now = dayjs('2026-06-25T12:00:00+08:00');
    vi.setSystemTime(now.toDate());
    mockedRedis.hgetall.mockResolvedValue({ battery_pct: '80' });

    const candidates = await evaluate('E001', makeCtx());
    expect(candidates.find(c => c.ruleId === 'R-DEV-02')).toBeUndefined();
    vi.useRealTimers();
  });

  it('无电量数据不触发', async () => {
    const now = dayjs('2026-06-25T12:00:00+08:00');
    vi.setSystemTime(now.toDate());
    mockedRedis.hgetall.mockResolvedValue({});

    const candidates = await evaluate('E001', makeCtx());
    expect(candidates.find(c => c.ruleId === 'R-DEV-02')).toBeUndefined();
    vi.useRealTimers();
  });
});
