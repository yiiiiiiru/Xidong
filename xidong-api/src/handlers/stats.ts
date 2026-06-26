/**
 * 统计 API
 * GET /me/stats
 *
 * 返回当前用户相关的工作统计数据
 */
import { AlertDao, ElderDao } from '../db/dao.js';
import dayjs from 'dayjs';

export async function getMyStats(userId: string): Promise<{ status: number; body: Record<string, unknown> }> {
  const today = dayjs().format('YYYY-MM-DD');

  // 并行查询各项统计
  const [pendingResult, processingResult, closedResult, totalElders] = await Promise.all([
    AlertDao.findAll({ status: 'pending', page: 1, pageSize: 1 }),
    AlertDao.findAll({ status: 'processing', page: 1, pageSize: 1 }),
    AlertDao.countClosedSince(today),
    ElderDao.count(),
  ]);

  return {
    status: 200,
    body: {
      user_id: userId,
      pending_count: pendingResult.total,
      processing_count: processingResult.total,
      closed_today: closedResult,
      total_elders: totalElders,
    },
  };
}
