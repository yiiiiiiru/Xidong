/**
 * notify.service 单元测试
 *
 * Mock fetch，验证：
 * - 正常推送 markdown 构建
 * - NOTIFY_ENABLED=false 跳过
 * - webhook 未配置降级到日志
 * - 签名计算
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// 保存原始环境变量
const originalEnv = { ...process.env };

// Mock fetch
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// 动态 import 以便每次测试可重置环境变量
async function loadNotify() {
  // 清除模块缓存
  vi.resetModules();
  return await import('../../src/services/notify.js');
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NOTIFY_ENABLED = 'true';
  process.env.DINGTALK_WEBHOOK = 'https://oapi.dingtalk.com/robot/send?access_token=test123';
  process.env.DINGTALK_SECRET = 'SEC_test_secret';
});

afterEach(() => {
  process.env = { ...originalEnv };
});

const mockPayload = {
  alertId: 'ALT001',
  elderName: '张奶奶',
  building: '3',
  room: '201',
  ruleId: 'R-BED-01',
  level: 'P1' as const,
  triggerDesc: '夜间离床已 35 分钟',
  triggeredAt: '2026-06-25T01:30:00+08:00',
};

describe('notifyAlert', () => {
  it('正常推送构建 markdown 并调用 fetch', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ errcode: 0, errmsg: 'ok' }),
    });

    const { notifyAlert } = await loadNotify();
    const result = await notifyAlert(mockPayload);

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('access_token=test123');
    expect(url).toContain('timestamp=');
    expect(url).toContain('sign=');

    const body = JSON.parse(options.body);
    expect(body.msgtype).toBe('markdown');
    expect(body.markdown.text).toContain('张奶奶');
    expect(body.markdown.text).toContain('R-BED-01');
    expect(body.markdown.text).toContain('3栋201');
  });

  it('NOTIFY_ENABLED=false 跳过推送', async () => {
    process.env.NOTIFY_ENABLED = 'false';

    const { notifyAlert } = await loadNotify();
    const result = await notifyAlert(mockPayload);

    expect(result).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('webhook 未配置时降级到日志', async () => {
    process.env.DINGTALK_WEBHOOK = '';

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { notifyAlert } = await loadNotify();
    const result = await notifyAlert(mockPayload);

    expect(result).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('fetch 失败返回 false 不抛异常', async () => {
    mockFetch.mockRejectedValue(new Error('network error'));

    const { notifyAlert } = await loadNotify();
    const result = await notifyAlert(mockPayload);

    expect(result).toBe(false);
  });

  it('钉钉返回非零 errcode 返回 false', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ errcode: 40001, errmsg: 'invalid token' }),
    });

    const { notifyAlert } = await loadNotify();
    const result = await notifyAlert(mockPayload);

    expect(result).toBe(false);
  });
});
