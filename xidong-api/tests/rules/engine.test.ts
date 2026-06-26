/**
 * 规则引擎单元测试
 *
 * 测试用例对齐：TC-SW-BTN-01/02/03 + TC-SW-GLOBAL-01
 *
 * 注意：这些测试仅测试 status-guard 和规则匹配逻辑
 * （不依赖 Redis 连接的纯函数部分）
 */

import { describe, it, expect } from 'vitest';
import type { AlertCandidate, ElderContext } from '../../src/types/index.js';
import { applySuppression, getEffectiveStatus } from '../../src/rules/status-guard.js';

// ─── 测试辅助数据 ───

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

function makeCandidate(overrides: Partial<AlertCandidate> = {}): AlertCandidate {
  return {
    ruleId: 'R-BTN',
    level: 'P0',
    elderId: 'E001',
    reason: '测试告警',
    context: {},
    ...overrides,
  };
}

// ─── TC-SW-BTN-01: R-BTN 基础触发 ───

describe('R-BTN 规则', () => {
  it('TC-SW-BTN-01: 按键告警候选级别为 P0', () => {
    const candidate = makeCandidate({
      ruleId: 'R-BTN',
      level: 'P0',
      reason: '床头一键报警长按触发',
    });

    expect(candidate.ruleId).toBe('R-BTN');
    expect(candidate.level).toBe('P0');
    expect(candidate.suppressed).toBeUndefined();
  });
});

// ─── TC-SW-BTN-02: R-BTN 穿透抑制 ───

describe('StatusGuard 状态抑制', () => {
  it('TC-SW-BTN-02: R-BTN 在老人外出状态下不被抑制', () => {
    const ctx = makeCtx({ status: 'away' });
    const candidates = [
      makeCandidate({ ruleId: 'R-BTN', level: 'P0' }),
    ];

    const result = applySuppression(candidates, ctx);

    expect(result).toHaveLength(1);
    expect(result[0].suppressed).toBeUndefined();
    expect(result[0].ruleId).toBe('R-BTN');
  });

  it('TC-SW-BTN-02: R-BTN 在老人住院状态下不被抑制', () => {
    const ctx = makeCtx({ status: 'hospital' });
    const candidates = [
      makeCandidate({ ruleId: 'R-BTN', level: 'P0' }),
    ];

    const result = applySuppression(candidates, ctx);

    expect(result).toHaveLength(1);
    expect(result[0].suppressed).toBeUndefined();
  });

  it('TC-SW-BTN-03: 非 R-BTN 规则在外出状态下被抑制', () => {
    const ctx = makeCtx({ status: 'away' });
    const candidates = [
      makeCandidate({ ruleId: 'R-BED-01', level: 'P1' }),
      makeCandidate({ ruleId: 'R-MIX-01', level: 'P0' }),
    ];

    const result = applySuppression(candidates, ctx);

    expect(result).toHaveLength(2);
    expect(result[0].suppressed).toBe(true);
    expect(result[0].suppressReason).toBe('away');
    expect(result[1].suppressed).toBe(true);
  });

  it('TC-SW-BTN-03: 非 R-BTN 规则在住院状态下被抑制', () => {
    const ctx = makeCtx({ status: 'hospital' });
    const candidates = [
      makeCandidate({ ruleId: 'R-DOOR-01', level: 'P2' }),
    ];

    const result = applySuppression(candidates, ctx);

    expect(result).toHaveLength(1);
    expect(result[0].suppressed).toBe(true);
    expect(result[0].suppressReason).toBe('hospital');
  });

  it('home 状态下不抑制任何告警', () => {
    const ctx = makeCtx({ status: 'home' });
    const candidates = [
      makeCandidate({ ruleId: 'R-BED-01', level: 'P1' }),
      makeCandidate({ ruleId: 'R-BTN', level: 'P0' }),
    ];

    const result = applySuppression(candidates, ctx);

    expect(result).toHaveLength(2);
    expect(result[0].suppressed).toBeUndefined();
    expect(result[1].suppressed).toBeUndefined();
  });

  it('paused 状态下抑制非 R-BTN，R-BTN 穿透', () => {
    const ctx = makeCtx({ status: 'paused' });
    const candidates = [
      makeCandidate({ ruleId: 'R-BTN', level: 'P0' }),
      makeCandidate({ ruleId: 'R-MIX-01', level: 'P0' }),
      makeCandidate({ ruleId: 'R-BED-04', level: 'P1' }),
    ];

    const result = applySuppression(candidates, ctx);

    expect(result).toHaveLength(3);
    // R-BTN 穿透
    expect(result[0].suppressed).toBeUndefined();
    // 其他被抑制
    expect(result[1].suppressed).toBe(true);
    expect(result[1].suppressReason).toBe('paused');
    expect(result[2].suppressed).toBe(true);
  });

  it('空候选列表返回空', () => {
    const ctx = makeCtx({ status: 'away' });
    const result = applySuppression([], ctx);
    expect(result).toHaveLength(0);
  });
});

// ─── TC-SW-GLOBAL-01: 状态窗口过期 ───

describe('getEffectiveStatus 状态窗口', () => {
  it('TC-SW-GLOBAL-01: 状态窗口过期后恢复为 home', () => {
    const pastEnd = new Date('2026-06-20T00:00:00+08:00');
    const ctx = makeCtx({
      status: 'away',
      statusWindow: {
        start: new Date('2026-06-15T00:00:00+08:00'),
        end: pastEnd,
      },
    });

    const now = new Date('2026-06-25T12:00:00+08:00');
    const result = getEffectiveStatus(ctx, now);

    expect(result).toBe('home');
  });

  it('状态窗口未过期时保持当前状态', () => {
    const futureEnd = new Date('2026-07-01T00:00:00+08:00');
    const ctx = makeCtx({
      status: 'hospital',
      statusWindow: {
        start: new Date('2026-06-20T00:00:00+08:00'),
        end: futureEnd,
      },
    });

    const now = new Date('2026-06-25T12:00:00+08:00');
    const result = getEffectiveStatus(ctx, now);

    expect(result).toBe('hospital');
  });

  it('无状态窗口的非 home 状态保持不变', () => {
    const ctx = makeCtx({ status: 'away' });
    const result = getEffectiveStatus(ctx);
    expect(result).toBe('away');
  });

  it('home 状态直接返回', () => {
    const ctx = makeCtx({ status: 'home' });
    const result = getEffectiveStatus(ctx);
    expect(result).toBe('home');
  });
});

// ─── 混合场景 ───

describe('混合场景', () => {
  it('R-BTN + 非BTN 在 away 状态：仅 R-BTN 通过', () => {
    const ctx = makeCtx({ status: 'away' });
    const candidates = [
      makeCandidate({ ruleId: 'R-BTN', level: 'P0', reason: '按键报警' }),
      makeCandidate({ ruleId: 'R-BED-01', level: 'P1', reason: '夜间离床' }),
      makeCandidate({ ruleId: 'R-DEV-02', level: 'P2', reason: '电量低' }),
    ];

    const result = applySuppression(candidates, ctx);
    const active = result.filter((r) => !r.suppressed);
    const suppressed = result.filter((r) => r.suppressed);

    expect(active).toHaveLength(1);
    expect(active[0].ruleId).toBe('R-BTN');
    expect(suppressed).toHaveLength(2);
  });

  it('所有 12 条规则 ID 在 rules.json 中存在', async () => {
    const { default: rules } = await import('../../src/rules/rules.json');
    const ruleIds = rules.map((r: { id: string }) => r.id);

    const expectedIds = [
      'R-BTN', 'R-MIX-01', 'R-MIX-02',
      'R-BED-01', 'R-BED-02', 'R-BED-03', 'R-BED-04',
      'R-BATH-01',
      'R-DOOR-01', 'R-DOOR-02',
      'R-DEV-01', 'R-DEV-02',
    ];

    expect(ruleIds).toEqual(expectedIds);
    expect(rules).toHaveLength(12);
  });

  it('规则等级分布正确: 3xP0 + 5xP1 + 4xP2', async () => {
    const { default: rules } = await import('../../src/rules/rules.json');

    const p0 = rules.filter((r: { level: string }) => r.level === 'P0');
    const p1 = rules.filter((r: { level: string }) => r.level === 'P1');
    const p2 = rules.filter((r: { level: string }) => r.level === 'P2');

    expect(p0).toHaveLength(3);
    expect(p1).toHaveLength(5);
    expect(p2).toHaveLength(4);
  });

  it('R-BTN 标记为 penetrateSuppress 和 skipDedup', async () => {
    const { default: rules } = await import('../../src/rules/rules.json');
    const btn = rules.find((r: { id: string }) => r.id === 'R-BTN');

    expect(btn).toBeDefined();
    expect(btn!.penetrateSuppress).toBe(true);
    expect(btn!.skipDedup).toBe(true);
  });
});
