/**
 * 老人档案 Handler
 * GET /api/elders
 * GET /api/elders/:id
 * POST /api/elders/import
 * PUT /api/elders/:id/status
 * PUT /api/elders/:id/info
 * DELETE /api/elders/:id
 *
 * 持久化: MySQL (via DAO)
 * Redis 仅保留: state:{elderId} (规则引擎) + evt:{elderId} (事件窗口)
 */
import type { ElderStatusType, PlanLevel, RiskClass, PaginatedResponse } from '../types/index.js';
import { ElderDao, ElderStatusDao, EmergencyContactDao } from '../db/dao.js';
import redis, { RedisKeys } from '../db/redis.js';

// ─── 数据结构（API 输出层）───

export interface ElderRecord {
  id: string;
  name: string;
  gender: 'M' | 'F';
  age: number;
  phone: string;
  id_card_last4: string;
  building: string;
  room: string;
  risk_class: RiskClass;
  plan_level: PlanLevel;
  status: ElderStatusType;
  status_window_start?: string;
  status_window_end?: string;
  is_homebound: boolean;
  emergency_contact: string;
  emergency_phone: string;
  property_phone: string;
  created_at: string;
}

// ─── 行转换 ───

function rowToElderRecord(row: Record<string, unknown> | { [key: string]: unknown }, contact?: { name: string; phone: string }): ElderRecord {
  return {
    id: String(row.id),
    name: String(row.name || ''),
    gender: row.gender === '男' ? 'F' : 'M',
    age: Number(row.age) || 0,
    phone: String(row.phone || ''),
    id_card_last4: String(row.id_card || '').slice(-4) || '0000',
    building: String(row.building || ''),
    room: String(row.room || ''),
    risk_class: (row.risk_class || 'C') as RiskClass,
    plan_level: (row.plan_level || 'basic') as PlanLevel,
    status: 'home' as ElderStatusType, // 从 elder_status 表动态获取
    is_homebound: row.is_homebound === 1 || row.is_homebound === true,
    emergency_contact: contact?.name || '',
    emergency_phone: contact?.phone || '',
    property_phone: String(row.property_phone || ''),
    created_at: row.created_at ? String(row.created_at).slice(0, 10) : '',
  };
}

// ─── GET /api/elders ───

export async function listElders(query: {
  page?: number;
  pageSize?: number;
  building?: string;
  riskClass?: RiskClass;
  planLevel?: PlanLevel;
  name?: string;
  role?: string;
  userBuilding?: string;
}): Promise<{ status: number; body: PaginatedResponse<ElderRecord> }> {
  // RBAC: 楼长只看本楼
  const buildingFilter = (query.role === 'building_manager' && query.userBuilding)
    ? query.userBuilding
    : query.building;

  const { items: rows, total } = await ElderDao.findAll({
    building: buildingFilter,
    riskClass: query.riskClass,
    planLevel: query.planLevel,
    name: query.name,
    page: query.page,
    pageSize: query.pageSize,
  });

  const elders: ElderRecord[] = [];
  for (const row of rows) {
    const contacts = await EmergencyContactDao.findByElderId(row.id);
    const first = contacts[0] as { name: string; phone: string } | undefined;
    elders.push(rowToElderRecord(row as unknown as Record<string, unknown>, first));
  }

  return { status: 200, body: { items: elders, total, page: query.page || 1, pageSize: query.pageSize || 20 } };
}

// ─── GET /api/elders/:id ───

export async function getElderDetail(
  elderId: string,
  role?: string
): Promise<{ status: number; body: Record<string, unknown> }> {
  const row = await ElderDao.findById(elderId);
  if (!row) {
    return { status: 404, body: { error: 'elder not found' } };
  }

  const contacts = await EmergencyContactDao.findByElderId(elderId);
  const first = contacts[0] as { name: string; phone: string } | undefined;
  const elder = rowToElderRecord(row as unknown as Record<string, unknown>, first);

  // 获取当前活跃状态
  const activeStatus = await ElderStatusDao.getActive(elderId);
  if (activeStatus) {
    elder.status = (activeStatus as { status: string }).status as ElderStatusType;
    elder.status_window_start = String((activeStatus as { start_at: string }).start_at).slice(0, 10);
    const endAt = (activeStatus as { end_at: string | null }).end_at;
    if (endAt) elder.status_window_end = String(endAt).slice(0, 10);
  }

  // RBAC: 楼长角色脱敏电话号
  if (role === 'building_manager') {
    elder.phone = maskPhone(elder.phone);
    elder.emergency_phone = maskPhone(elder.emergency_phone);
  }

  // 获取关联设备（仍从 Redis，因设备管理还未迁移）
  const deviceKeys = await redis.keys(`device_map:DEV_${elderId}_*`);
  const devices: Record<string, string>[] = [];
  for (const key of deviceKeys) {
    const d = await redis.hgetall(key);
    devices.push({ devId: key.replace('device_map:', ''), ...d });
  }

  return { status: 200, body: { ...elder, devices, emergency_contacts: contacts } };
}

// ─── POST /api/elders/import ───

export async function importElders(
  records: Array<Partial<ElderRecord>>
): Promise<{ status: number; body: Record<string, unknown> }> {
  let created = 0;
  let updated = 0;

  for (const rec of records) {
    if (!rec.id || !rec.name) continue;

    const result = await ElderDao.upsert({
      id: rec.id,
      name: rec.name,
      gender: rec.gender === 'F' ? '女' : '男',
      age: rec.age || 80,
      phone: rec.phone || '',
      building: rec.building || '1',
      room: rec.room || '101',
      risk_class: rec.risk_class || 'C',
      plan_level: rec.plan_level || 'basic',
      is_homebound: rec.is_homebound ? 1 : 0,
      property_phone: rec.property_phone || '13800138000',
    });

    if (result === 'created') created++;
    else updated++;

    // 导入紧急联系人
    if (rec.emergency_contact && rec.emergency_phone) {
      await EmergencyContactDao.upsert(rec.id, rec.emergency_contact, rec.emergency_phone, '子女');
    }
  }

  console.log(`[Elder] import: ${created} created, ${updated} updated`);
  return { status: 200, body: { success: true, created, updated } };
}

// ─── PUT /api/elders/:id/status ───

export async function setElderStatus(
  elderId: string,
  status: ElderStatusType,
  startAt: string,
  endAt: string,
  note?: string,
  createdBy?: string
): Promise<{ status: number; body: Record<string, unknown> }> {
  const exists = await ElderDao.findById(elderId);
  if (!exists) {
    return { status: 404, body: { error: 'elder not found' } };
  }

  // MySQL 持久化
  await ElderStatusDao.create(elderId, status, startAt, endAt || undefined, note, createdBy);

  // 同步到 Redis state hash（规则引擎读取）
  await redis.hset(RedisKeys.state(elderId), 'status', status);
  if (startAt) await redis.hset(RedisKeys.state(elderId), 'statusWindowStart', startAt);
  if (endAt) await redis.hset(RedisKeys.state(elderId), 'statusWindowEnd', endAt);

  console.log(`[Elder] ${elderId} status → ${status} (${startAt} ~ ${endAt}) by ${createdBy || 'system'}`);
  return { status: 200, body: { success: true, elder_id: elderId, new_status: status } };
}

// ─── PUT /api/elders/:id/info ───

export async function updateElder(
  elderId: string,
  data: Partial<ElderRecord>,
  operatorRole?: string
): Promise<{ status: number; body: Record<string, unknown> }> {
  // 权限：楼长不能编辑档案
  if (operatorRole === 'building_manager') {
    return { status: 403, body: { error: 'building_manager cannot edit elder info' } };
  }

  const exists = await ElderDao.findById(elderId);
  if (!exists) {
    return { status: 404, body: { error: 'elder not found' } };
  }

  const updates: Record<string, unknown> = {};
  if (data.name) updates.name = data.name;
  if (data.gender) updates.gender = data.gender === 'F' ? '女' : '男';
  if (data.age) updates.age = data.age;
  if (data.phone) updates.phone = data.phone;
  if (data.building) updates.building = data.building;
  if (data.room) updates.room = data.room;
  if (data.risk_class) updates.risk_class = data.risk_class;
  if (data.plan_level) updates.plan_level = data.plan_level;
  if (data.is_homebound !== undefined) updates.is_homebound = data.is_homebound ? 1 : 0;
  if (data.emergency_contact) updates.emergency_contact = data.emergency_contact;
  if (data.emergency_phone) updates.emergency_phone = data.emergency_phone;
  if (data.property_phone) updates.property_phone = data.property_phone;

  if (Object.keys(updates).length === 0) {
    return { status: 400, body: { error: 'no fields to update' } };
  }

  await ElderDao.update(elderId, updates as Record<string, string>);

  console.log(`[Elder] updated: ${elderId}`);
  return { status: 200, body: { success: true, elder_id: elderId, updated_fields: Object.keys(updates) } };
}

// ─── DELETE /api/elders/:id ───

export async function deleteElder(
  elderId: string,
  operatorRole?: string
): Promise<{ status: number; body: Record<string, unknown> }> {
  // 权限：仅 director / social_worker 可删除
  if (operatorRole === 'building_manager' || operatorRole === 'property') {
    return { status: 403, body: { error: 'insufficient permission to delete elder' } };
  }

  const exists = await ElderDao.findById(elderId);
  if (!exists) {
    return { status: 404, body: { error: 'elder not found' } };
  }

  // MySQL CASCADE 会自动删除 emergency_contact, elder_status, device, meal_record
  await ElderDao.delete(elderId);

  // 清理 Redis 规则引擎缓存
  await redis.del(RedisKeys.state(elderId));
  await redis.del(RedisKeys.events(elderId));

  console.log(`[Elder] deleted: ${elderId}`);
  return { status: 200, body: { success: true, elder_id: elderId } };
}

// ─── 工具 ───

function maskPhone(phone: string): string {
  if (phone.length >= 11) return phone.slice(0, 3) + '****' + phone.slice(-4);
  return phone;
}
