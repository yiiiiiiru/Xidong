/**
 * 统一数据访问层 (DAO)
 * MySQL 持久化 — 替代 Redis Hash/Set 作为主存储
 * Redis 仅保留：规则引擎 state/events、告警 dedup/fp/escalation
 */
import pool from './mysql.js';
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SqlParams = any[];

// ─── 通用工具 ───

function buildWhere(conditions: [string, unknown][]): { clause: string; params: SqlParams } {
  const parts: string[] = [];
  const params: SqlParams = [];
  for (const [col, val] of conditions) {
    if (val === undefined || val === null) continue;
    if (col.includes('LIKE')) {
      parts.push(col);
      params.push(`%${val}%`);
    } else {
      parts.push(`${col} = ?`);
      params.push(val);
    }
  }
  return {
    clause: parts.length ? `WHERE ${parts.join(' AND ')}` : '',
    params,
  };
}

// ─── Elder DAO ───

export interface ElderRow {
  id: string;
  name: string;
  gender: string;
  age: number;
  phone: string;
  id_card: string;
  building: string;
  unit: string;
  room: string;
  risk_class: string;
  plan_level: string;
  chronic_disease: string | null;
  habit_profile: string | null;
  is_homebound: number;
  property_phone: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const ElderDao = {
  async findAll(filters: {
    building?: string;
    riskClass?: string;
    planLevel?: string;
    name?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: ElderRow[]; total: number }> {
    const { clause, params } = buildWhere([
      ['building', filters.building],
      ['risk_class', filters.riskClass],
      ['plan_level', filters.planLevel],
      ['name LIKE ?', filters.name],
    ]);

    const page = filters.page || 1;
    const pageSize = Math.min(filters.pageSize || 20, 50);
    const offset = (page - 1) * pageSize;

    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as cnt FROM elder ${clause}`, params as SqlParams
    );
    const total = (countRows[0] as { cnt: number }).cnt;

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM elder ${clause} ORDER BY risk_class ASC, id ASC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset] as SqlParams
    );

    return { items: rows as ElderRow[], total };
  },

  async findById(id: string): Promise<ElderRow | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM elder WHERE id = ?', [id]
    );
    return (rows[0] as ElderRow) || null;
  },

  async create(data: Partial<ElderRow>): Promise<string> {
    const id = data.id || `E${Date.now().toString(36)}`;
    await pool.execute(
      `INSERT INTO elder (id, name, gender, age, phone, id_card, building, unit, room,
        risk_class, plan_level, is_homebound, property_phone, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, data.name || '', data.gender || '男', data.age || 80,
        data.phone || '', data.id_card || '', data.building || '1',
        data.unit || '', data.room || '101',
        data.risk_class || 'C', data.plan_level || 'basic',
        data.is_homebound || 0, data.property_phone || '', data.notes || null,
      ]
    );
    return id;
  },

  async upsert(data: Partial<ElderRow>): Promise<'created' | 'updated'> {
    const existing = data.id ? await ElderDao.findById(data.id) : null;
    if (existing) {
      await ElderDao.update(data.id!, data);
      return 'updated';
    }
    await ElderDao.create(data);
    return 'created';
  },

  async update(id: string, data: Partial<ElderRow>): Promise<boolean> {
    const sets: string[] = [];
    const params: SqlParams = [];
    const allowed = ['name', 'gender', 'age', 'phone', 'building', 'unit', 'room',
      'risk_class', 'plan_level', 'is_homebound', 'property_phone', 'notes',
      'chronic_disease', 'habit_profile', 'id_card'] as const;
    for (const key of allowed) {
      if ((data as Record<string, unknown>)[key] !== undefined) {
        sets.push(`${key} = ?`);
        params.push((data as Record<string, unknown>)[key]);
      }
    }
    if (!sets.length) return false;
    params.push(id);
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE elder SET ${sets.join(', ')} WHERE id = ?`, params as SqlParams
    );
    return result.affectedRows > 0;
  },

  async delete(id: string): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      'DELETE FROM elder WHERE id = ?', [id]
    );
    return result.affectedRows > 0;
  },

  async count(): Promise<number> {
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT COUNT(*) as cnt FROM elder');
    return (rows[0] as { cnt: number }).cnt;
  },
};

// ─── Emergency Contact DAO ───

export const EmergencyContactDao = {
  async findByElderId(elderId: string): Promise<RowDataPacket[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM emergency_contact WHERE elder_id = ? ORDER BY priority ASC', [elderId]
    );
    return rows;
  },

  async upsert(elderId: string, name: string, phone: string, relation?: string, priority?: number): Promise<void> {
    await pool.execute(
      `INSERT INTO emergency_contact (elder_id, name, phone, relation, priority)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE phone = VALUES(phone), relation = VALUES(relation)`,
      [elderId, name, phone, relation || '', priority || 1]
    );
  },
};

// ─── Elder Status DAO ───

export const ElderStatusDao = {
  async getActive(elderId: string): Promise<RowDataPacket | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM elder_status WHERE elder_id = ? AND end_at IS NULL
       ORDER BY start_at DESC LIMIT 1`, [elderId]
    );
    return rows[0] || null;
  },

  async create(elderId: string, status: string, startAt: string, endAt?: string, note?: string, createdBy?: string): Promise<void> {
    // 结束现有活跃状态
    await pool.execute(
      `UPDATE elder_status SET end_at = NOW(), ended_early = 1
       WHERE elder_id = ? AND end_at IS NULL`, [elderId]
    );
    await pool.execute(
      `INSERT INTO elder_status (elder_id, status, start_at, end_at, note, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [elderId, status, startAt, endAt || null, note || null, createdBy || null]
    );
  },
};

// ─── Meal DAO ───

export interface MealRow {
  id: string;
  elder_id: string;
  meal_date: string;
  meal_type: string;
  check_method: string;
  amount: number;
  operator_id: string;
  note: string;
  checked_at: string;
}

export const MealDao = {
  async findAll(filters: {
    elderId?: string;
    mealDate?: string;
    mealType?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: MealRow[]; total: number }> {
    const { clause, params } = buildWhere([
      ['elder_id', filters.elderId],
      ['meal_date', filters.mealDate],
      ['meal_type', filters.mealType],
    ]);

    const page = filters.page || 1;
    const pageSize = Math.min(filters.pageSize || 20, 50);
    const offset = (page - 1) * pageSize;

    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as cnt FROM meal_record ${clause}`, params as SqlParams
    );
    const total = (countRows[0] as { cnt: number }).cnt;

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM meal_record ${clause} ORDER BY checked_at DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset] as SqlParams
    );

    return { items: rows as MealRow[], total };
  },

  async findById(id: string): Promise<MealRow | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM meal_record WHERE id = ?', [id]
    );
    return (rows[0] as MealRow) || null;
  },

  async create(data: Omit<MealRow, 'checked_at'> & { checked_at?: string }): Promise<{ success: boolean; duplicate?: boolean }> {
    try {
      await pool.execute(
        `INSERT INTO meal_record (id, elder_id, meal_date, meal_type, check_method, amount, operator_id, note, checked_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [data.id, data.elder_id, data.meal_date, data.meal_type,
          data.check_method || 'manual', data.amount || 0,
          data.operator_id || '', data.note || '',
          data.checked_at || new Date().toISOString()]
      );
      return { success: true };
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
        return { success: false, duplicate: true };
      }
      throw err;
    }
  },

  async update(id: string, data: { amount?: number; note?: string; meal_type?: string }): Promise<boolean> {
    const sets: string[] = [];
    const params: SqlParams = [];
    if (data.amount !== undefined) { sets.push('amount = ?'); params.push(data.amount); }
    if (data.note !== undefined) { sets.push('note = ?'); params.push(data.note); }
    if (data.meal_type) { sets.push('meal_type = ?'); params.push(data.meal_type); }
    if (!sets.length) return false;
    params.push(id);
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE meal_record SET ${sets.join(', ')} WHERE id = ?`, params as SqlParams
    );
    return result.affectedRows > 0;
  },

  async delete(id: string): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      'DELETE FROM meal_record WHERE id = ?', [id]
    );
    return result.affectedRows > 0;
  },

  async stats(date: string, building?: string): Promise<{
    breakfast: number; lunch: number; dinner: number;
    uniqueElders: number; totalElders: number;
  }> {
    let sql = `SELECT meal_type, COUNT(*) as cnt, COUNT(DISTINCT elder_id) as elders
               FROM meal_record WHERE meal_date = ?`;
    const params: SqlParams = [date];
    if (building) {
      sql += ` AND elder_id IN (SELECT id FROM elder WHERE building = ?)`;
      params.push(building);
    }
    sql += ` GROUP BY meal_type`;

    const [rows] = await pool.execute<RowDataPacket[]>(sql, params as SqlParams);
    let breakfast = 0, lunch = 0, dinner = 0;
    const elderSet = new Set<string>();

    for (const row of rows as Array<{ meal_type: string; cnt: number; elders: number }>) {
      if (row.meal_type === 'breakfast') breakfast = row.cnt;
      else if (row.meal_type === 'lunch') lunch = row.cnt;
      else if (row.meal_type === 'dinner') dinner = row.cnt;
    }

    // unique elders for the day
    const [uniqueRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(DISTINCT elder_id) as cnt FROM meal_record WHERE meal_date = ?` +
      (building ? ` AND elder_id IN (SELECT id FROM elder WHERE building = ?)` : ''),
      building ? [date, building] : [date]
    );
    const uniqueElders = (uniqueRows[0] as { cnt: number }).cnt;
    const totalElders = await ElderDao.count();

    return { breakfast, lunch, dinner, uniqueElders, totalElders };
  },
};

// ─── Worker DAO ───

export interface WorkerRow {
  id: string;
  name: string;
  dingtalk_user_id: string;
  role: string;
  building: string | null;
  phone: string;
  on_duty: number;
  created_at: string;
}

export const WorkerDao = {
  async findAll(filters: {
    role?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: WorkerRow[]; total: number }> {
    const { clause, params } = buildWhere([
      ['role', filters.role],
    ]);

    const page = filters.page || 1;
    const pageSize = Math.min(filters.pageSize || 20, 50);
    const offset = (page - 1) * pageSize;

    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as cnt FROM social_worker ${clause}`, params as SqlParams
    );
    const total = (countRows[0] as { cnt: number }).cnt;

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM social_worker ${clause} ORDER BY name ASC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset] as SqlParams
    );

    return { items: rows as WorkerRow[], total };
  },

  async findById(id: string): Promise<WorkerRow | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM social_worker WHERE id = ?', [id]
    );
    return (rows[0] as WorkerRow) || null;
  },

  async create(data: Partial<WorkerRow>): Promise<string> {
    const id = data.id || `W${Date.now().toString(36)}`;
    await pool.execute(
      `INSERT INTO social_worker (id, name, dingtalk_user_id, role, building, phone, on_duty)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, data.name || '', data.dingtalk_user_id || '', data.role || 'social_worker',
        data.building || null, data.phone || '', data.on_duty || 0]
    );
    return id;
  },

  async update(id: string, data: Partial<WorkerRow>): Promise<boolean> {
    const sets: string[] = [];
    const params: SqlParams = [];
    if (data.name) { sets.push('name = ?'); params.push(data.name); }
    if (data.role) { sets.push('role = ?'); params.push(data.role); }
    if (data.building !== undefined) { sets.push('building = ?'); params.push(data.building || null); }
    if (data.phone) { sets.push('phone = ?'); params.push(data.phone); }
    if (data.on_duty !== undefined) { sets.push('on_duty = ?'); params.push(data.on_duty); }
    if (data.dingtalk_user_id) { sets.push('dingtalk_user_id = ?'); params.push(data.dingtalk_user_id); }
    if (!sets.length) return false;
    params.push(id);
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE social_worker SET ${sets.join(', ')} WHERE id = ?`, params as SqlParams
    );
    return result.affectedRows > 0;
  },

  async delete(id: string): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      'DELETE FROM social_worker WHERE id = ?', [id]
    );
    return result.affectedRows > 0;
  },
};

// ─── Alert DAO ───

export interface AlertRow {
  id: string;
  elder_id: string;
  rule_id: string;
  level: string;
  status: string;
  trigger_desc: string;
  context_json: string | null;
  handler_id: string | null;
  handler_note: string | null;
  false_positive_reason: string | null;
  triggered_at: string;
  handled_at: string | null;
  closed_at: string | null;
}

export const AlertDao = {
  async findAll(filters: {
    level?: string;
    status?: string;
    elderId?: string;
    building?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: AlertRow[]; total: number }> {
    const conditions: [string, unknown][] = [
      ['a.level', filters.level],
      ['a.status', filters.status],
      ['a.elder_id', filters.elderId],
    ];
    // building filter via elder join
    let joinClause = '';
    if (filters.building) {
      joinClause = ' JOIN elder e ON a.elder_id = e.id';
      conditions.push(['e.building', filters.building]);
    }

    const { clause, params } = buildWhere(conditions);
    const page = filters.page || 1;
    const pageSize = Math.min(filters.pageSize || 20, 50);
    const offset = (page - 1) * pageSize;

    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as cnt FROM alert a${joinClause} ${clause}`, params as SqlParams
    );
    const total = (countRows[0] as { cnt: number }).cnt;

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT a.* FROM alert a${joinClause} ${clause} ORDER BY a.triggered_at DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset] as SqlParams
    );

    return { items: rows as AlertRow[], total };
  },

  async findById(id: string): Promise<AlertRow | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM alert WHERE id = ?', [id]
    );
    return (rows[0] as AlertRow) || null;
  },

  async create(data: Partial<AlertRow>): Promise<string> {
    const id = data.id || `ALT_${Date.now().toString(36)}`;
    await pool.execute(
      `INSERT INTO alert (id, elder_id, rule_id, level, status, trigger_desc, context_json, triggered_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.elder_id, data.rule_id, data.level, data.status || 'pending',
        data.trigger_desc || '', data.context_json || null,
        data.triggered_at || new Date().toISOString()] as SqlParams
    );
    return id;
  },

  async update(id: string, data: Partial<AlertRow>): Promise<boolean> {
    const sets: string[] = [];
    const params: SqlParams = [];
    if (data.status) { sets.push('status = ?'); params.push(data.status); }
    if (data.handler_id) { sets.push('handler_id = ?'); params.push(data.handler_id); }
    if (data.handler_note !== undefined) { sets.push('handler_note = ?'); params.push(data.handler_note); }
    if (data.handled_at) { sets.push('handled_at = ?'); params.push(data.handled_at); }
    if (data.closed_at) { sets.push('closed_at = ?'); params.push(data.closed_at); }
    if (data.false_positive_reason) { sets.push('false_positive_reason = ?'); params.push(data.false_positive_reason); }
    if (!sets.length) return false;
    params.push(id);
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE alert SET ${sets.join(', ')} WHERE id = ?`, params as SqlParams
    );
    return result.affectedRows > 0;
  },

  async addTimeline(alertId: string, eventType: string, channel?: string, meta?: Record<string, unknown>): Promise<void> {
    await pool.execute(
      `INSERT INTO alert_timeline (alert_id, event_type, channel, meta)
       VALUES (?, ?, ?, ?)`,
      [alertId, eventType, channel || null, meta ? JSON.stringify(meta) : null]
    );
  },

  async getTimeline(alertId: string): Promise<RowDataPacket[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM alert_timeline WHERE alert_id = ? ORDER BY created_at ASC', [alertId]
    );
    return rows;
  },

  async addFalsePositiveLog(alertId: string, elderId: string, ruleId: string, reason: string, workerId?: string): Promise<void> {
    await pool.execute(
      `INSERT INTO false_positive_log (alert_id, elder_id, rule_id, reason, social_worker_id)
       VALUES (?, ?, ?, ?, ?)`,
      [alertId, elderId, ruleId, reason, workerId || null]
    );
  },

  async countClosedSince(sinceDate: string): Promise<number> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as cnt FROM alert WHERE (status = 'closed' OR status = 'closed_false_positive') AND closed_at >= ?`,
      [sinceDate]
    );
    return (rows[0] as { cnt: number }).cnt;
  },
};

// ─── SensorEvent DAO ───

export const SensorEventDao = {
  async create(data: {
    elder_id: string;
    device_id: string;
    event_type: string;
    payload: string;
    event_time: string;
  }): Promise<void> {
    await pool.execute(
      `INSERT INTO sensor_event (elder_id, device_id, event_type, payload, event_time) VALUES (?, ?, ?, ?, ?)`,
      [data.elder_id, data.device_id, data.event_type, data.payload, data.event_time]
    );
  },
};

// ─── Device DAO ───

export interface DeviceRow {
  id: number;
  elder_id: number;
  tuya_device_id: string;
  device_type: 'button' | 'bed' | 'pir' | 'door';
  location: string;
  battery_pct: number;
  last_event_at: string | null;
  online: number;
  created_at: string;
}

export const DeviceDao = {
  async findByTuyaId(tuyaDeviceId: string): Promise<DeviceRow | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM device WHERE tuya_device_id = ? LIMIT 1`,
      [tuyaDeviceId]
    );
    return (rows[0] as DeviceRow) || null;
  },

  async findByElder(elderId: string): Promise<DeviceRow[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM device WHERE elder_id = ? ORDER BY device_type`,
      [elderId]
    );
    return rows as DeviceRow[];
  },

  async create(data: Omit<DeviceRow, 'id' | 'created_at' | 'last_event_at'>): Promise<void> {
    await pool.execute(
      `INSERT INTO device (elder_id, tuya_device_id, device_type, location, battery_pct, online) VALUES (?, ?, ?, ?, ?, ?)`,
      [data.elder_id, data.tuya_device_id, data.device_type, data.location, data.battery_pct ?? 100, data.online ?? 1]
    );
  },

  async updateBattery(tuyaDeviceId: string, batteryPct: number): Promise<void> {
    await pool.execute(
      `UPDATE device SET battery_pct = ?, last_event_at = NOW() WHERE tuya_device_id = ?`,
      [batteryPct, tuyaDeviceId]
    );
  },

  async updateOnline(tuyaDeviceId: string, online: boolean): Promise<void> {
    await pool.execute(
      `UPDATE device SET online = ? WHERE tuya_device_id = ?`,
      [online ? 1 : 0, tuyaDeviceId]
    );
  },

  async touchLastEvent(tuyaDeviceId: string): Promise<void> {
    await pool.execute(
      `UPDATE device SET last_event_at = NOW() WHERE tuya_device_id = ?`,
      [tuyaDeviceId]
    );
  },

  async delete(id: number): Promise<void> {
    await pool.execute(`DELETE FROM device WHERE id = ?`, [id]);
  },
};
