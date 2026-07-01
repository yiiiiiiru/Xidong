/**
 * 溪东社区智慧养老 MVP — FC HTTP Handler 入口
 * 本地开发使用 Node.js HTTP server 模拟 FC 环境
 */
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { handleTuyaWebhook, handleDingtalkWebhook } from './handlers/webhook.js';
import { mockAlert, mockEvent, seedDevices } from './handlers/internal.js';
import { listAlerts, getAlertDetail, handleAlert } from './handlers/alert.js';
import { listElders, getElderDetail, importElders, setElderStatus, updateElder, deleteElder } from './handlers/elder.js';
import { checkinMeal, importMeals, listMeals, mealStats, updateMeal, cancelMeal } from './handlers/meal.js';
import { listWorkers, getWorkerDetail, createWorker, updateWorker, deleteWorker } from './handlers/worker.js';
import { getMyStats } from './handlers/stats.js';
import { parseAuthUser, requireRole } from './middleware/rbac.js';
import { validate, HandleAlertSchema, ElderImportSchema, ElderStatusSchema, ElderUpdateSchema, MealCheckinSchema, MealImportSchema, TuyaWebhookSchema } from './schemas.js';
import type { UserRole, AuthUser } from './types/index.js';

const PORT = Number(process.env.PORT) || 7071;

/**
 * 简易路由器
 */
interface Route {
  method: string;
  pattern: RegExp;
  handler: (req: IncomingMessage, res: ServerResponse, params: Record<string, string>, user: AuthUser) => Promise<void>;
  roles?: UserRole[]; // 允许访问的角色，空 = 无限制
}

const routes: Route[] = [];

function addRoute(method: string, path: string, handler: Route['handler'], roles?: UserRole[]) {
  const pattern = new RegExp(
    '^' + path.replace(/:([a-zA-Z_]+)/g, '(?<$1>[^/]+)') + '$'
  );
  routes.push({ method: method.toUpperCase(), pattern, handler, roles });
}

// ─── 路由注册 ───────────────────────────────────
// TODO: W1·D2-D5 逐步实现

addRoute('GET', '/api/health', async (_req, res, _p, _u) => {
  json(res, 200, { status: 'ok', service: 'xidong-api', version: '0.1.0' });
});

// 告警
addRoute('GET', '/api/alerts', async (req, res, _p, user) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  // ponytail: property 角色只看 P0，spec RBAC 矩阵要求
  const levelParam = user.role === 'property' ? 'P0' : url.searchParams.get('level');
  const query = {
    level: levelParam as Parameters<typeof listAlerts>[0]['level'],
    status: url.searchParams.get('status') as Parameters<typeof listAlerts>[0]['status'],
    elderId: url.searchParams.get('elder_id') || undefined,
    building: user.role === 'building_manager' ? user.building : (url.searchParams.get('building') || undefined),
    page: Number(url.searchParams.get('page')) || 1,
    pageSize: Number(url.searchParams.get('page_size')) || 20,
  };
  const result = await listAlerts(query);
  json(res, result.status, result.body);
});

addRoute('GET', '/api/alerts/:id', async (_req, res, params, _u) => {
  const result = await getAlertDetail(params.id);
  json(res, result.status, result.body);
});

addRoute('PUT', '/api/alerts/:id/handle', async (req, res, params, user) => {
  const body = await parseBody(req);
  const v = validate(HandleAlertSchema, body);
  if (!v.success) { json(res, 400, { error: v.error, details: v.details }); return; }
  const result = await handleAlert(
    params.id,
    v.data.action,
    user.userId,
    v.data.note,
    v.data.false_positive_reason,
  );
  json(res, result.status, result.body);
}, ['social_worker', 'property', 'director']);

// 档案
addRoute('GET', '/api/elders', async (req, res, _p, user) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const query = {
    building: user.role === 'building_manager' ? user.building : (url.searchParams.get('building') || undefined),
    riskClass: url.searchParams.get('risk_class') as Parameters<typeof listElders>[0]['riskClass'],
    planLevel: url.searchParams.get('plan_level') as Parameters<typeof listElders>[0]['planLevel'],
    name: url.searchParams.get('name') || undefined,
    page: Number(url.searchParams.get('page')) || 1,
    pageSize: Number(url.searchParams.get('page_size')) || 20,
    role: user.role,
    userBuilding: user.building,
  };
  const result = await listElders(query);
  json(res, result.status, result.body);
});

addRoute('GET', '/api/elders/:id', async (_req, res, params, user) => {
  const result = await getElderDetail(params.id, user.role);
  json(res, result.status, result.body);
});

addRoute('POST', '/api/elders/import', async (req, res, _p, _u) => {
  const body = await parseBody(req);
  const v = validate(ElderImportSchema, body);
  if (!v.success) { json(res, 400, { error: v.error, details: v.details }); return; }
  const result = await importElders(v.data.records as Array<Record<string, unknown>>);
  json(res, result.status, result.body);
}, ['social_worker', 'director']);

addRoute('PUT', '/api/elders/:id/status', async (req, res, params, user) => {
  const body = await parseBody(req);
  const v = validate(ElderStatusSchema, body);
  if (!v.success) { json(res, 400, { error: v.error, details: v.details }); return; }
  const result = await setElderStatus(
    params.id,
    v.data.status as Parameters<typeof setElderStatus>[1],
    v.data.start_at,
    v.data.end_at || '',
    v.data.note,
    user.userId,
  );
  json(res, result.status, result.body);
}, ['social_worker', 'director']);

// Webhook
addRoute('POST', '/api/webhook/tuya', async (req, res, _p, _u) => {
  const body = await parseBody(req);
  const v = validate(TuyaWebhookSchema, body);
  if (!v.success) { json(res, 400, { error: v.error, details: v.details }); return; }
  const result = await handleTuyaWebhook(body, getHeaders(req));
  json(res, result.status, result.body);
});

addRoute('POST', '/api/webhook/dingtalk', async (req, res, _p, _u) => {
  const body = await parseBody(req);
  const result = await handleDingtalkWebhook(body, getHeaders(req));
  json(res, result.status, result.body);
});

// 内部
addRoute('POST', '/api/internal/mock-alert', async (req, res, _p, _u) => {
  const body = await parseBody(req);
  const result = await mockAlert(body as Parameters<typeof mockAlert>[0]);
  json(res, result.status, result.body);
});

addRoute('POST', '/api/internal/mock-event', async (req, res, _p, _u) => {
  const body = await parseBody(req);
  const result = await mockEvent(body as Parameters<typeof mockEvent>[0]);
  json(res, result.status, result.body);
});

addRoute('POST', '/api/internal/seed-devices', async (req, res, _p, _u) => {
  const body = await parseBody(req);
  const result = await seedDevices(body as Parameters<typeof seedDevices>[0]);
  json(res, result.status, result.body);
});

addRoute('GET', '/api/me/stats', async (_req, res, _p, user) => {
  const result = await getMyStats(user.userId);
  json(res, result.status, result.body);
});

// 食堂签到/消费
addRoute('POST', '/api/meals/checkin', async (req, res, _p, user) => {
  const body = await parseBody(req);
  const v = validate(MealCheckinSchema, body);
  if (!v.success) { json(res, 400, { error: v.error, details: v.details }); return; }
  const result = await checkinMeal({ ...v.data, operator_id: user.userId });
  json(res, result.status, result.body);
}, ['social_worker', 'director']);

addRoute('POST', '/api/meals/import', async (req, res, _p, user) => {
  const body = await parseBody(req);
  const v = validate(MealImportSchema, body);
  if (!v.success) { json(res, 400, { error: v.error, details: v.details }); return; }
  const result = await importMeals({ ...v.data, operator_id: user.userId });
  json(res, result.status, result.body);
}, ['social_worker', 'director']);

addRoute('GET', '/api/meals', async (req, res, _p, _u) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const result = await listMeals({
    elder_id: url.searchParams.get('elder_id') || undefined,
    meal_date: url.searchParams.get('date') || undefined,
    meal_type: url.searchParams.get('meal_type') as Parameters<typeof listMeals>[0]['meal_type'],
    page: Number(url.searchParams.get('page')) || 1,
    pageSize: Number(url.searchParams.get('page_size')) || 20,
  });
  json(res, result.status, result.body);
});

addRoute('GET', '/api/meals/stats', async (req, res, _p, _u) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const result = await mealStats({
    date: url.searchParams.get('date') || undefined,
    building: url.searchParams.get('building') || undefined,
  });
  json(res, result.status, result.body);
});

addRoute('PUT', '/api/meals/:id', async (req, res, params, user) => {
  const body = await parseBody(req) as Record<string, unknown>;
  const result = await updateMeal(params.id, body as Parameters<typeof updateMeal>[1], user.role);
  json(res, result.status, result.body);
}, ['social_worker', 'director']);

addRoute('DELETE', '/api/meals/:id', async (_req, res, params, user) => {
  const result = await cancelMeal(params.id, user.role);
  json(res, result.status, result.body);
}, ['social_worker', 'director']);

// 老人档案编辑/删除
addRoute('PUT', '/api/elders/:id/info', async (req, res, params, user) => {
  const body = await parseBody(req) as Record<string, unknown>;
  const result = await updateElder(params.id, body as Parameters<typeof updateElder>[1], user.role, user.name);
  json(res, result.status, result.body);
}, ['social_worker', 'director']);

addRoute('DELETE', '/api/elders/:id', async (_req, res, params, user) => {
  const result = await deleteElder(params.id, user.role);
  json(res, result.status, result.body);
}, ['social_worker', 'director']);

// 新增单个老人
addRoute('POST', '/api/elders', async (req, res, _p, user) => {
  const body = await parseBody(req);
  if (!body.name || !body.building) { json(res, 400, { error: '姓名和楼栋必填' }); return; }
  const { ElderDao } = await import('./db/dao.js');
  body.created_by = user.name || user.userId;
  const id = await ElderDao.create(body);
  json(res, 201, { success: true, id });
}, ['social_worker', 'director']);

// ─── 老人负责人分配 ───

// 查询某老人的负责人列表
addRoute('GET', '/api/elders/:id/assignments', async (_req, res, params, _u) => {
  const { ElderAssignmentDao } = await import('./db/dao.js');
  const rows = await ElderAssignmentDao.findByElder(params.id);
  json(res, 200, { items: rows });
});

// 分配负责人
addRoute('POST', '/api/elders/:id/assignments', async (req, res, params, user) => {
  const body = await parseBody(req);
  if (!body.worker_id) { json(res, 400, { error: 'worker_id 必填' }); return; }
  const { ElderAssignmentDao } = await import('./db/dao.js');
  await ElderAssignmentDao.assign(params.id, body.worker_id, body.role, user.name || user.userId);
  json(res, 201, { success: true });
}, ['social_worker', 'director']);

// 移除负责人
addRoute('DELETE', '/api/elders/:id/assignments/:worker_id', async (_req, res, params, _u) => {
  const { ElderAssignmentDao } = await import('./db/dao.js');
  const ok = await ElderAssignmentDao.remove(params.id, params.worker_id);
  json(res, ok ? 200 : 404, ok ? { success: true } : { error: 'not found' });
}, ['social_worker', 'director']);

// 我负责的老人
addRoute('GET', '/api/my-elders', async (_req, res, _p, user) => {
  const { ElderAssignmentDao, WorkerDao } = await import('./db/dao.js');
  // 通过 userId 找到对应的 worker 记录
  const workers = await WorkerDao.findAll({});
  const worker = (workers.items as Array<{id: string; dingtalk_user_id: string | null}>).find(
    w => w.id === user.userId || w.dingtalk_user_id === user.userId
  );
  if (!worker) { json(res, 200, { items: [], total: 0 }); return; }
  const rows = await ElderAssignmentDao.findByWorker(worker.id);
  json(res, 200, { items: rows, total: rows.length });
});

// 工作人员管理
addRoute('GET', '/api/workers', async (req, res, _p, _u) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const result = await listWorkers({
    role: url.searchParams.get('role') as UserRole | undefined,
    page: Number(url.searchParams.get('page')) || 1,
    pageSize: Number(url.searchParams.get('page_size')) || 20,
  });
  json(res, result.status, result.body);
}, ['social_worker', 'director']);

addRoute('GET', '/api/workers/:id', async (_req, res, params, _u) => {
  const result = await getWorkerDetail(params.id);
  json(res, result.status, result.body);
}, ['social_worker', 'director']);

addRoute('POST', '/api/workers', async (req, res, _p, user) => {
  const body = await parseBody(req) as Record<string, unknown>;
  const result = await createWorker(body as Parameters<typeof createWorker>[0], user.role);
  json(res, result.status, result.body);
}, ['social_worker', 'director']);

addRoute('PUT', '/api/workers/:id', async (req, res, params, user) => {
  const body = await parseBody(req) as Record<string, unknown>;
  const result = await updateWorker(params.id, body as Parameters<typeof updateWorker>[1], user.role);
  json(res, result.status, result.body);
}, ['social_worker', 'director']);

addRoute('DELETE', '/api/workers/:id', async (_req, res, params, user) => {
  const result = await deleteWorker(params.id, user.role);
  json(res, result.status, result.body);
}, ['social_worker', 'director']);

// ─── HTTP Server ────────────────────────────────────────────────

function parseBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString()));
      } catch {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function getHeaders(req: IncomingMessage): Record<string, string> {
  const h: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (typeof v === 'string') h[k] = v;
  }
  return h;
}

// ─── CORS 白名单配置 ───
const CORS_WHITELIST = (process.env.CORS_ORIGINS || '').split(',').filter(Boolean);
const IS_PROD = process.env.NODE_ENV === 'production';

function getCorsOrigin(req: IncomingMessage): string {
  const origin = req.headers.origin || '';
  // 开发环境允许所有
  if (!IS_PROD) return origin || '*';
  // 生产环境仅允许白名单
  if (CORS_WHITELIST.includes(origin)) return origin;
  return '';
}

// ─── 内部 API Token 防护 ───
const INTERNAL_TOKEN = process.env.INTERNAL_API_TOKEN || '';

function verifyInternalToken(req: IncomingMessage): boolean {
  // 开发环境无 token 时允许访问
  if (!IS_PROD && !INTERNAL_TOKEN) return true;
  const authHeader = req.headers['x-internal-token'] || req.headers['authorization'];
  if (!authHeader) return false;
  const token = typeof authHeader === 'string' ? authHeader.replace('Bearer ', '') : '';
  return token === INTERNAL_TOKEN;
}

function json(res: ServerResponse, status: number, data: unknown, req?: IncomingMessage) {
  const corsOrigin = req ? getCorsOrigin(req) : '*';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-User-Id,X-Role,X-Building,X-User-Name,X-Internal-Token',
  };
  if (corsOrigin) {
    headers['Access-Control-Allow-Origin'] = corsOrigin;
  }
  res.writeHead(status, headers);
  res.end(JSON.stringify(data));
}

const server = createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    json(res, 204, null, req);
    return;
  }

  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // 内部 API Token 防护
  if (pathname.startsWith('/api/internal/')) {
    if (IS_PROD) {
      json(res, 403, { error: 'FORBIDDEN', message: 'Internal API disabled in production' }, req);
      return;
    }
    if (INTERNAL_TOKEN && !verifyInternalToken(req)) {
      json(res, 401, { error: 'UNAUTHORIZED', message: 'Invalid internal API token' }, req);
      return;
    }
  }

  // 解析用户身份
  const headers: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (typeof v === 'string') headers[k] = v;
  }
  const user = parseAuthUser(headers);

  for (const route of routes) {
    if (route.method !== req.method) continue;
    const match = pathname.match(route.pattern);
    if (!match) continue;

    // RBAC 检查
    if (route.roles && route.roles.length > 0) {
      if (!route.roles.includes(user.role)) {
        json(res, 403, { error: 'FORBIDDEN', message: `角色 ${user.role} 无权访问此接口` }, req);
        return;
      }
    }

    try {
      await route.handler(req, res, match.groups || {}, user);
    } catch (err) {
      console.error(`[ERROR] ${req.method} ${pathname}:`, err);
      json(res, 500, { error: 'INTERNAL', message: (err as Error).message }, req);
    }
    return;
  }

  json(res, 404, { error: 'NOT_FOUND', path: pathname }, req);
});

server.listen(PORT, () => {
  console.log(`🏥 溪东养老 MVP API 启动: http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
  console.log(`   环境: ${process.env.NODE_ENV || 'development'}`);
});
