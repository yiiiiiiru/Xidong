/**
 * Zod 入参校验 Schema
 *
 * 统一定义各 handler 的请求体/查询参数校验规则
 * 生产环境保证脏数据不入库
 */

import { z } from 'zod';

// ─── 告警处置 ───

export const HandleAlertSchema = z.object({
  action: z.enum(['acknowledge', 'safe', 'false_positive', 'dispatch', 'visit_done']),
  note: z.string().max(500).optional(),
  false_positive_reason: z.enum(['bathing', 'visitor', 'pet', 'device_fault', 'other']).optional(),
});

// ─── 老人档案导入 ───

export const ElderImportItemSchema = z.object({
  name: z.string().min(1).max(50),
  gender: z.enum(['男', '女']).optional().default('男'),
  age: z.number().int().min(0).max(130).optional(),
  building: z.string().min(1).max(20),
  unit: z.string().max(20).optional(),
  room: z.string().max(20).optional(),
  phone: z.string().max(20).optional(),
  id_card: z.string().max(64).optional(),
  risk_class: z.enum(['A', 'B', 'C']).optional().default('C'),
  plan_level: z.enum(['full', 'standard', 'basic']).optional().default('basic'),
  is_homebound: z.union([z.boolean(), z.number()]).optional().default(false),
  property_phone: z.string().max(20).optional(),
  notes: z.string().max(2000).optional(),
});

export const ElderImportSchema = z.object({
  records: z.array(ElderImportItemSchema).min(1).max(500),
});

// ─── 老人状态设置 ───

export const ElderStatusSchema = z.object({
  status: z.enum(['away', 'hospital', 'paused']),
  start_at: z.string().min(1, '开始日期必填'),
  end_at: z.string().optional(),
  note: z.string().max(500).optional(),
});

// ─── 老人档案编辑 ───

export const ElderUpdateSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  phone: z.string().max(20).optional(),
  risk_class: z.enum(['A', 'B', 'C']).optional(),
  plan_level: z.enum(['full', 'standard', 'basic']).optional(),
  is_homebound: z.union([z.boolean(), z.number()]).optional(),
  property_phone: z.string().max(20).optional(),
  notes: z.string().max(2000).optional(),
}).refine(obj => Object.keys(obj).length > 0, { message: '至少提供一个更新字段' });

// ─── 食堂签到 ───

export const MealCheckinSchema = z.object({
  elder_id: z.string().min(1, 'elder_id 必填'),
  elder_name: z.string().optional(),
  meal_type: z.enum(['breakfast', 'lunch', 'dinner']),
  meal_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式 YYYY-MM-DD').optional(),
  check_method: z.enum(['manual', 'scan', 'import']).optional(),
  amount: z.number().min(0).optional(),
  operator_id: z.string().optional(),
  note: z.string().max(500).optional(),
});

export const MealImportSchema = z.object({
  records: z.array(z.object({
    elder_id: z.string().min(1),
    meal_type: z.enum(['breakfast', 'lunch', 'dinner']),
    meal_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    amount: z.number().min(0).optional(),
  })).min(1).max(500),
  operator_id: z.string().optional(),
});

// ─── 涂鸦 Webhook ───

export const TuyaWebhookSchema = z.object({
  devId: z.string().min(1),
  productKey: z.string().optional(),
  dataId: z.string().optional(),
  status: z.array(z.object({
    code: z.string(),
    value: z.unknown(),
    t: z.number(),
  })).min(1),
});

// ─── 工具：统一校验并返回错误 ───

export function validate<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string; details: z.ZodIssue[] } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: 'VALIDATION_ERROR',
    details: result.error.issues,
  };
}
