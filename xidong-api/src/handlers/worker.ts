/**
 * 工作人员管理 Handler
 * GET    /api/workers          — 列表
 * GET    /api/workers/:id      — 详情
 * POST   /api/workers          — 新增
 * PUT    /api/workers/:id      — 更新
 * DELETE /api/workers/:id      — 删除
 *
 * 权限：仅 director 角色可增删改，其他角色只读
 * 持久化: MySQL (via DAO)
 */
import type { UserRole, PaginatedResponse } from '../types/index.js';
import { WorkerDao } from '../db/dao.js';

// ─── 数据结构 ───

export interface WorkerRecord {
  id: string;
  name: string;
  dingtalk_user_id: string;
  role: UserRole;
  building?: string;       // 楼长专属
  phone: string;
  on_duty: boolean;
  created_at: string;
}

// ─── 行转换 ───

function rowToWorkerRecord(row: Record<string, unknown> | { [key: string]: unknown }): WorkerRecord {
  return {
    id: String(row.id),
    name: String(row.name || ''),
    dingtalk_user_id: String(row.dingtalk_user_id || ''),
    role: (row.role || 'social_worker') as UserRole,
    building: row.building ? String(row.building) : undefined,
    phone: String(row.phone || ''),
    on_duty: row.on_duty === 1 || row.on_duty === true,
    created_at: row.created_at ? String(row.created_at).slice(0, 10) : '',
  };
}

// ─── GET /api/workers ───

export async function listWorkers(query: {
  role?: UserRole;
  page?: number;
  pageSize?: number;
}): Promise<{ status: number; body: PaginatedResponse<WorkerRecord> }> {
  const { items: rows, total } = await WorkerDao.findAll({
    role: query.role,
    page: query.page,
    pageSize: query.pageSize,
  });

  const workers = rows.map(r => rowToWorkerRecord(r as unknown as Record<string, unknown>));

  return { status: 200, body: { items: workers, total, page: query.page || 1, pageSize: query.pageSize || 20 } };
}

// ─── GET /api/workers/:id ───

export async function getWorkerDetail(
  workerId: string
): Promise<{ status: number; body: Record<string, unknown> }> {
  const row = await WorkerDao.findById(workerId);
  if (!row) {
    return { status: 404, body: { error: 'worker not found' } };
  }
  return { status: 200, body: rowToWorkerRecord(row as unknown as Record<string, unknown>) as unknown as Record<string, unknown> };
}

// ─── POST /api/workers ───

export async function createWorker(
  data: Partial<WorkerRecord>,
  operatorRole: UserRole
): Promise<{ status: number; body: Record<string, unknown> }> {
  // 权限：仅 director 可创建
  if (operatorRole !== 'director') {
    return { status: 403, body: { error: 'only director can manage workers' } };
  }

  if (!data.name || !data.role) {
    return { status: 400, body: { error: 'name and role required' } };
  }

  const id = await WorkerDao.create({
    id: data.id,
    name: data.name,
    dingtalk_user_id: data.dingtalk_user_id || '',
    role: data.role,
    building: data.building || null,
    phone: data.phone || '',
    on_duty: data.on_duty ? 1 : 0,
  });

  const worker: WorkerRecord = {
    id,
    name: data.name,
    dingtalk_user_id: data.dingtalk_user_id || '',
    role: data.role,
    building: data.building,
    phone: data.phone || '',
    on_duty: data.on_duty || false,
    created_at: new Date().toISOString().slice(0, 10),
  };

  console.log(`[Worker] created: ${worker.name} (${worker.role})`);
  return { status: 200, body: { success: true, worker } };
}

// ─── PUT /api/workers/:id ───

export async function updateWorker(
  workerId: string,
  data: Partial<WorkerRecord>,
  operatorRole: UserRole
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (operatorRole !== 'director') {
    return { status: 403, body: { error: 'only director can manage workers' } };
  }

  const exists = await WorkerDao.findById(workerId);
  if (!exists) {
    return { status: 404, body: { error: 'worker not found' } };
  }

  await WorkerDao.update(workerId, {
    name: data.name || undefined,
    role: data.role || undefined,
    building: data.building !== undefined ? (data.building || null) : undefined,
    phone: data.phone || undefined,
    on_duty: data.on_duty !== undefined ? (data.on_duty ? 1 : 0) : undefined,
    dingtalk_user_id: data.dingtalk_user_id || undefined,
  });

  console.log(`[Worker] updated: ${workerId}`);
  return { status: 200, body: { success: true, worker_id: workerId } };
}

// ─── DELETE /api/workers/:id ───

export async function deleteWorker(
  workerId: string,
  operatorRole: UserRole
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (operatorRole !== 'director') {
    return { status: 403, body: { error: 'only director can manage workers' } };
  }

  const exists = await WorkerDao.findById(workerId);
  if (!exists) {
    return { status: 404, body: { error: 'worker not found' } };
  }

  await WorkerDao.delete(workerId);

  console.log(`[Worker] deleted: ${workerId}`);
  return { status: 200, body: { success: true, worker_id: workerId } };
}
