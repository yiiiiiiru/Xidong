/**
 * Alert handler 单元测试
 *
 * 测试状态机转换逻辑（纯逻辑，mock DAO）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock DAO 和 Redis
vi.mock('../../src/db/dao.js', () => ({
  AlertDao: {
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    addTimeline: vi.fn(),
    addFalsePositiveLog: vi.fn(),
  },
  ElderDao: {
    findById: vi.fn(),
  },
}));

vi.mock('../../src/db/redis.js', () => ({
  default: {
    set: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
  },
  RedisKeys: {
    falsePositive: (elderId: string, ruleId: string) => `fp:${elderId}:${ruleId}`,
  },
}));

import { handleAlert } from '../../src/handlers/alert.js';
import { AlertDao } from '../../src/db/dao.js';

const mockedAlertDao = vi.mocked(AlertDao);

// ─── 辅助 ───

function mockAlertRow(status: string) {
  return {
    id: 'A001',
    elder_id: 'E001',
    rule_id: 'R-BED-01',
    level: 'P1',
    status,
    trigger_desc: '夜间离床已 35 分钟',
    triggered_at: '2026-06-25T01:00:00Z',
    handler_id: null,
    handler_note: null,
    closed_at: null,
    false_positive_reason: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── 状态机测试 ───

describe('handleAlert 状态机', () => {
  it('pending → acknowledge → processing', async () => {
    mockedAlertDao.findById.mockResolvedValue(mockAlertRow('pending') as any);
    mockedAlertDao.update.mockResolvedValue(undefined as any);
    mockedAlertDao.addTimeline.mockResolvedValue(undefined as any);

    const result = await handleAlert('A001', 'acknowledge', 'SW001');

    expect(result.status).toBe(200);
    expect(result.body.new_status).toBe('processing');
    expect(mockedAlertDao.update).toHaveBeenCalledWith('A001', expect.objectContaining({ status: 'processing' }));
  });

  it('pending → false_positive → closed_false_positive', async () => {
    mockedAlertDao.findById.mockResolvedValue(mockAlertRow('pending') as any);
    mockedAlertDao.update.mockResolvedValue(undefined as any);
    mockedAlertDao.addTimeline.mockResolvedValue(undefined as any);
    mockedAlertDao.addFalsePositiveLog.mockResolvedValue(undefined as any);

    const result = await handleAlert('A001', 'false_positive', 'SW001', undefined, 'bathing');

    expect(result.status).toBe(200);
    expect(result.body.new_status).toBe('closed_false_positive');
  });

  it('processing → safe → closed', async () => {
    mockedAlertDao.findById.mockResolvedValue(mockAlertRow('processing') as any);
    mockedAlertDao.update.mockResolvedValue(undefined as any);
    mockedAlertDao.addTimeline.mockResolvedValue(undefined as any);

    const result = await handleAlert('A001', 'safe', 'SW001', '已确认安全');

    expect(result.status).toBe(200);
    expect(result.body.new_status).toBe('closed');
  });

  it('processing → dispatch → dispatched', async () => {
    mockedAlertDao.findById.mockResolvedValue(mockAlertRow('processing') as any);
    mockedAlertDao.update.mockResolvedValue(undefined as any);
    mockedAlertDao.addTimeline.mockResolvedValue(undefined as any);

    const result = await handleAlert('A001', 'dispatch', 'SW001');

    expect(result.status).toBe(200);
    expect(result.body.new_status).toBe('dispatched');
  });

  it('dispatched → visit_done → closed', async () => {
    mockedAlertDao.findById.mockResolvedValue(mockAlertRow('dispatched') as any);
    mockedAlertDao.update.mockResolvedValue(undefined as any);
    mockedAlertDao.addTimeline.mockResolvedValue(undefined as any);

    const result = await handleAlert('A001', 'visit_done', 'BM001');

    expect(result.status).toBe(200);
    expect(result.body.new_status).toBe('closed');
  });
});

// ─── 非法转换 ───

describe('handleAlert 非法转换', () => {
  it('pending 不能直接 safe', async () => {
    mockedAlertDao.findById.mockResolvedValue(mockAlertRow('pending') as any);

    const result = await handleAlert('A001', 'safe', 'SW001');

    expect(result.status).toBe(422);
    expect(result.body.error).toBe('invalid_action');
  });

  it('closed 不能做任何操作', async () => {
    mockedAlertDao.findById.mockResolvedValue(mockAlertRow('closed') as any);

    const result = await handleAlert('A001', 'acknowledge', 'SW001');

    expect(result.status).toBe(422);
  });

  it('不存在的告警返回 404', async () => {
    mockedAlertDao.findById.mockResolvedValue(null as any);

    const result = await handleAlert('NOPE', 'acknowledge', 'SW001');

    expect(result.status).toBe(404);
  });
});
