/**
 * 路由注册器 — 供各模块路由文件使用
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { UserRole, AuthUser } from '../types/index.js';

export interface Route {
  method: string;
  pattern: RegExp;
  handler: (req: IncomingMessage, res: ServerResponse, params: Record<string, string>, user: AuthUser) => Promise<void>;
  roles?: UserRole[];
}

export const routes: Route[] = [];

export function addRoute(method: string, path: string, handler: Route['handler'], roles?: UserRole[]) {
  const pattern = new RegExp(
    '^' + path.replace(/:([a-zA-Z_]+)/g, '(?<$1>[^/]+)') + '$'
  );
  routes.push({ method: method.toUpperCase(), pattern, handler, roles });
}
