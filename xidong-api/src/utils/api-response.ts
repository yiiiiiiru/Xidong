/**
 * 统一错误响应 — 标准化 API 错误格式
 *
 * 所有 handler 错误统一为:
 * { code: string, message: string, details?: unknown }
 */

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'UNAUTHORIZED'
  | 'CONFLICT'
  | 'INVALID_ACTION'
  | 'INTERNAL';

export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: unknown;
}

export interface ApiResult<T = unknown> {
  status: number;
  body: T | ApiError;
}

// ─── 快捷构造器 ───

export function ok<T>(data: T, status = 200): ApiResult<T> {
  return { status, body: data };
}

export function created<T>(data: T): ApiResult<T> {
  return { status: 201, body: data };
}

export function notFound(resource: string, id?: string): ApiResult<never> {
  return {
    status: 404,
    body: { code: 'NOT_FOUND', message: `${resource}${id ? ` (${id})` : ''} not found` } as ApiError as never,
  };
}

export function forbidden(message = '权限不足'): ApiResult<never> {
  return {
    status: 403,
    body: { code: 'FORBIDDEN', message } as ApiError as never,
  };
}

export function validationError(message: string, details?: unknown): ApiResult<never> {
  return {
    status: 400,
    body: { code: 'VALIDATION_ERROR', message, details } as ApiError as never,
  };
}

export function conflict(message: string): ApiResult<never> {
  return {
    status: 409,
    body: { code: 'CONFLICT', message } as ApiError as never,
  };
}

export function invalidAction(currentStatus: string, allowed: string[]): ApiResult<never> {
  return {
    status: 422,
    body: {
      code: 'INVALID_ACTION',
      message: `当前状态 ${currentStatus} 不允许此操作`,
      details: { current_status: currentStatus, allowed },
    } as ApiError as never,
  };
}

export function internalError(message: string): ApiResult<never> {
  return {
    status: 500,
    body: { code: 'INTERNAL', message } as ApiError as never,
  };
}
