/**
 * 食堂签到/消费记录 Handler
 * POST /api/meals/checkin   — 单条签到
 * POST /api/meals/import    — 批量导入
 * GET  /api/meals           — 查询记录
 * GET  /api/meals/stats     — 就餐统计
 * PUT  /api/meals/:id       — 修改
 * DELETE /api/meals/:id     — 撤销
 *
 * 持久化: MySQL (via DAO)
 * 去重: MySQL UNIQUE KEY uk_elder_meal (不再需要 Redis dedup key)
 */
import type { PaginatedResponse } from '../types/index.js';
import { MealDao, ElderDao } from '../db/dao.js';

// ─── 数据结构 ───

type MealType = 'breakfast' | 'lunch' | 'dinner';
type CheckMethod = 'manual' | 'scan' | 'import';

export interface MealRecord {
  id: string;
  elder_id: string;
  elder_name: string;
  meal_date: string;      // YYYY-MM-DD
  meal_type: MealType;
  check_method: CheckMethod;
  amount: number;          // 消费金额（元）
  operator_id: string;
  note: string;
  checked_at: string;
}

// ─── POST /api/meals/checkin ───

export async function checkinMeal(body: {
  elder_id: string;
  elder_name?: string;
  meal_type: MealType;
  meal_date?: string;
  check_method?: CheckMethod;
  amount?: number;
  operator_id?: string;
  note?: string;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!body.elder_id || !body.meal_type) {
    return { status: 400, body: { error: 'elder_id and meal_type required' } };
  }

  const mealDate = body.meal_date || new Date().toISOString().slice(0, 10);
  const id = `meal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  // 获取老人名称
  let elderName = body.elder_name || '';
  if (!elderName) {
    const elder = await ElderDao.findById(body.elder_id);
    if (elder) elderName = elder.name;
  }

  const result = await MealDao.create({
    id,
    elder_id: body.elder_id,
    meal_date: mealDate,
    meal_type: body.meal_type,
    check_method: body.check_method || 'manual',
    amount: body.amount || 0,
    operator_id: body.operator_id || 'anonymous',
    note: body.note || '',
    checked_at: new Date().toISOString(),
  });

  if (!result.success && result.duplicate) {
    return { status: 409, body: { error: 'already_checked' } };
  }

  const record: MealRecord = {
    id,
    elder_id: body.elder_id,
    elder_name: elderName,
    meal_date: mealDate,
    meal_type: body.meal_type,
    check_method: body.check_method || 'manual',
    amount: body.amount || 0,
    operator_id: body.operator_id || 'anonymous',
    note: body.note || '',
    checked_at: new Date().toISOString(),
  };

  return { status: 200, body: { success: true, record } };
}

// ─── POST /api/meals/import ───

export async function importMeals(body: {
  records: Array<{
    elder_id: string;
    elder_name?: string;
    meal_type: MealType;
    meal_date?: string;
    amount?: number;
  }>;
  operator_id?: string;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!body.records?.length) {
    return { status: 400, body: { error: 'records array required' } };
  }

  let created = 0;
  let skipped = 0;

  for (const rec of body.records) {
    const result = await checkinMeal({
      ...rec,
      check_method: 'import',
      operator_id: body.operator_id,
    });
    if (result.status === 200) created++;
    else skipped++;
  }

  return {
    status: 200,
    body: { success: true, created, skipped, total: body.records.length },
  };
}

// ─── GET /api/meals ───

export async function listMeals(query: {
  elder_id?: string;
  meal_date?: string;
  meal_type?: MealType;
  page?: number;
  pageSize?: number;
}): Promise<{ status: number; body: PaginatedResponse<MealRecord> }> {
  const page = query.page || 1;
  const pageSize = query.pageSize || 20;

  const { items: rows, total } = await MealDao.findAll({
    elderId: query.elder_id,
    mealDate: query.meal_date,
    mealType: query.meal_type,
    page,
    pageSize,
  });

  // 补充 elder_name（join 或 batch 查）
  const records: MealRecord[] = [];
  for (const row of rows) {
    let elderName = '';
    const elder = await ElderDao.findById(row.elder_id);
    if (elder) elderName = elder.name;
    records.push({
      id: row.id,
      elder_id: row.elder_id,
      elder_name: elderName,
      meal_date: String(row.meal_date).slice(0, 10),
      meal_type: row.meal_type as MealType,
      check_method: row.check_method as CheckMethod,
      amount: Number(row.amount) || 0,
      operator_id: row.operator_id || '',
      note: row.note || '',
      checked_at: String(row.checked_at),
    });
  }

  return { status: 200, body: { items: records, total, page, pageSize } };
}

// ─── GET /api/meals/stats ───

export async function mealStats(query: {
  date?: string;
  building?: string;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const targetDate = query.date || new Date().toISOString().slice(0, 10);

  const stats = await MealDao.stats(targetDate, query.building);

  return {
    status: 200,
    body: {
      date: targetDate,
      breakfast: stats.breakfast,
      lunch: stats.lunch,
      dinner: stats.dinner,
      total_checkins: stats.breakfast + stats.lunch + stats.dinner,
      unique_elders: stats.uniqueElders,
      total_elders: stats.totalElders,
      coverage_rate: stats.totalElders > 0
        ? Math.round((stats.uniqueElders / stats.totalElders) * 100)
        : 0,
    },
  };
}

// ─── PUT /api/meals/:id ───

export async function updateMeal(
  mealId: string,
  data: { amount?: number; note?: string; meal_type?: MealType },
  operatorRole?: string
): Promise<{ status: number; body: Record<string, unknown> }> {
  // 权限：楼长不能修改食堂记录
  if (operatorRole === 'building_manager') {
    return { status: 403, body: { error: 'building_manager cannot edit meal records' } };
  }

  const row = await MealDao.findById(mealId);
  if (!row) {
    return { status: 404, body: { error: 'meal record not found' } };
  }

  const updated = await MealDao.update(mealId, data);
  if (!updated) {
    return { status: 400, body: { error: 'no fields to update' } };
  }

  return { status: 200, body: { success: true, meal_id: mealId } };
}

// ─── DELETE /api/meals/:id ───

export async function cancelMeal(
  mealId: string,
  operatorRole?: string
): Promise<{ status: number; body: Record<string, unknown> }> {
  // 权限：楼长/物业不能撤销
  if (operatorRole === 'building_manager' || operatorRole === 'property') {
    return { status: 403, body: { error: 'insufficient permission to cancel meal' } };
  }

  const row = await MealDao.findById(mealId);
  if (!row) {
    return { status: 404, body: { error: 'meal record not found' } };
  }

  await MealDao.delete(mealId);

  console.log(`[Meal] cancelled: ${mealId}`);
  return { status: 200, body: { success: true, meal_id: mealId } };
}
