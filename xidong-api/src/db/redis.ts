/**
 * Redis 客户端
 */
import Redis from 'ioredis';

const redis = new (Redis as unknown as typeof Redis.default)({
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: 3,
  retryStrategy(times: number) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

export default redis;

// Redis Key 工具函数
export const RedisKeys = {
  /** 48h 传感器事件窗口 */
  events: (elderId: string) => `evt:${elderId}`,
  /** 老人当前状态 Hash */
  state: (elderId: string) => `state:${elderId}`,
  /** 5min 告警去重 */
  dedup: (elderId: string, level: string, ruleId: string) =>
    `dedup:${elderId}:${level}:${ruleId}`,
  /** 7天误报抑制 */
  falsePositive: (elderId: string, ruleId: string) =>
    `fp:${elderId}:${ruleId}`,
  /** 双呼升级状态 */
  escalation: (alertId: string) => `escalation:${alertId}`,
};
