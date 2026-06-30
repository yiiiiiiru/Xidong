/**
 * API 封装 — axios 实例 + 接口定义
 */
import axios from 'axios'
import { useUserStore } from '@/stores/user'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 请求拦截：从 Pinia store 取用户信息
api.interceptors.request.use((config) => {
  const userStore = useUserStore()
  if (userStore.token) {
    config.headers.Authorization = `Bearer ${userStore.token}`
  }
  // 注入用户上下文 header（后端 RBAC 依赖）
  if (userStore.user) {
    config.headers['X-User-Id'] = userStore.userId
    config.headers['X-Role'] = userStore.role
    config.headers['X-User-Name'] = userStore.user.name
    if (userStore.building) {
      config.headers['X-Building'] = userStore.building
    }
  }
  return config
})

// 响应拦截：统一错误处理，无后端时 fallback 到 mock
import { getMockResponse } from './mock-data'

// ponytail: 检测后端是否可用，不可用则全部走 mock；升级路径：MSW
let backendAvailable: boolean | null = null

async function checkBackend(): Promise<boolean> {
  if (backendAvailable !== null) return backendAvailable
  try {
    const resp = await fetch((import.meta.env.VITE_API_BASE || '/api') + '/health', { signal: AbortSignal.timeout(1500) })
    const ct = resp.headers.get('content-type') || ''
    backendAvailable = resp.ok && ct.includes('json')
  } catch {
    backendAvailable = false
  }
  return backendAvailable
}
checkBackend()

// 请求拦截：后端不可用时直接返回 mock（不发真实请求）
api.interceptors.request.use(async (config) => {
  const available = await checkBackend()
  if (!available) {
    const url = config.url || ''
    console.warn('[API Mock] 后端不可用，使用演示数据:', url)
    // 利用 CancelToken 中断请求，adapter 返回 mock
    return Promise.reject({ __mock: true, url })
  }
  return config
})

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    // mock fallback
    if (error.__mock) {
      return Promise.resolve(getMockResponse(error.url))
    }
    const msg = error.response?.data?.error || '网络错误'
    console.error('[API Error]', msg, error.response?.status)
    return Promise.reject(error)
  }
)

// ─── 接口定义 ─── (W1·D2-D5 逐步完善)

export interface Alert {
  id: string
  elder_id: string
  elder_name: string
  building: string
  rule_id: string
  level: 'P0' | 'P1' | 'P2'
  status: string
  trigger_desc: string
  triggered_at: string
}

export interface Elder {
  id: string
  name: string
  gender: string
  age: number
  building: string
  unit: string
  room: string
  risk_class: 'A' | 'B' | 'C'
  plan_level: 'full' | 'standard' | 'basic'
  assignments?: Array<{ worker_id: string; worker_name: string; role: string }>
}

// 告警 API
export const alertApi = {
  list: (params?: Record<string, unknown>) => api.get('/alerts', { params }),
  detail: (id: string) => api.get(`/alerts/${id}`),
  handle: (id: string, data: { action: string; note?: string; false_positive_reason?: string }) =>
    api.put(`/alerts/${id}/handle`, data),
}

// 档案 API
export const elderApi = {
  list: (params?: Record<string, unknown>) => api.get('/elders', { params }),
  detail: (id: string) => api.get(`/elders/${id}`),
  importExcel: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/elders/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  setStatus: (id: string, data: Record<string, unknown>) =>
    api.put(`/elders/${id}/status`, data),
}

// 统计 API
export const statsApi = {
  me: () => api.get('/me/stats'),
}

// 食堂签到/消费 API
export interface MealRecord {
  id: string
  elder_id: string
  elder_name: string
  meal_date: string
  meal_type: 'breakfast' | 'lunch' | 'dinner'
  check_method: 'manual' | 'scan' | 'import'
  amount: number
  checked_at: string
}

export const mealApi = {
  checkin: (data: { elder_id: string; meal_type: string; amount?: number; note?: string }) =>
    api.post('/meals/checkin', data),
  import: (records: Array<{ elder_id: string; meal_type: string; meal_date?: string; amount?: number }>) =>
    api.post('/meals/import', { records }),
  list: (params?: Record<string, unknown>) => api.get('/meals', { params }),
  stats: (params?: { date?: string; building?: string }) => api.get('/meals/stats', { params }),
  update: (id: string, data: Record<string, unknown>) => api.put(`/meals/${id}`, data),
  cancel: (id: string) => api.delete(`/meals/${id}`),
}

// 老人档案补充
export const elderApiExt = {
  create: (data: Record<string, unknown>) => api.post('/elders', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/elders/${id}/info`, data),
  delete: (id: string) => api.delete(`/elders/${id}`),
}

// 工作人员管理 API
export interface Worker {
  id: string
  name: string
  dingtalk_user_id: string
  role: string
  building?: string
  phone: string
  on_duty: boolean
}

export const workerApi = {
  list: (params?: Record<string, unknown>) => api.get('/workers', { params }),
  detail: (id: string) => api.get(`/workers/${id}`),
  create: (data: Partial<Worker>) => api.post('/workers', data),
  update: (id: string, data: Partial<Worker>) => api.put(`/workers/${id}`, data),
  delete: (id: string) => api.delete(`/workers/${id}`),
}

// 老人负责人分配 API
export interface Assignment {
  worker_id: string
  worker_name: string
  role: string
}

export const assignmentApi = {
  list: (elderId: string) => api.get(`/elders/${elderId}/assignments`),
  assign: (elderId: string, data: { worker_id: string; role?: string }) =>
    api.post(`/elders/${elderId}/assignments`, data),
  remove: (elderId: string, workerId: string) =>
    api.delete(`/elders/${elderId}/assignments/${workerId}`),
  myElders: () => api.get('/my-elders'),
}

export default api
