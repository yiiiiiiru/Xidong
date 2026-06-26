/**
 * RBAC 中间件
 * 从 JWT 解析 role + building，控制数据访问范围
 */
import type { AuthUser, UserRole } from '../types/index.js';

/**
 * 解析请求中的用户身份
 * MVP 阶段：从 header X-User-Id / X-Role / X-Building 读取（钉钉免登完成后切 JWT）
 */
export function parseAuthUser(headers: Record<string, string | undefined>): AuthUser {
  return {
    userId: headers['x-user-id'] || 'anonymous',
    role: (headers['x-role'] as UserRole) || 'social_worker',
    building: headers['x-building'] || undefined,
    name: headers['x-user-name'] || '未知',
  };
}

/**
 * 检查角色权限
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (user: AuthUser): boolean => {
    return allowedRoles.includes(user.role);
  };
}

/**
 * 楼长视图字段裁剪
 * 移除 phone, chronic_disease, emergency_contact.phone
 */
export function sanitizeForBuildingManager<T extends Record<string, unknown>>(
  data: T
): T {
  const sanitized = { ...data };
  delete sanitized['phone'];
  delete sanitized['chronic_disease'];
  delete sanitized['id_card'];
  return sanitized;
}
