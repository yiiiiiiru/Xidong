/**
 * 涂鸦 IoT Pulsar 消费者
 *
 * TUYA_MOCK=true（默认）时不连接 Pulsar，仅打日志。
 * 生产环境设 TUYA_MOCK=false 后会连接涂鸦消息队列，
 * 将设备事件转发给 webhook handler 处理。
 *
 * ponytail: MVP 阶段设备事件通过 HTTP webhook 接入而非 Pulsar，
 * 此文件仅作为 spec 要求的占位 + 未来升级路径。
 * 升级路径：接入 @tuya/pulsar-mq SDK，订阅 event topic。
 *
 * @module services/tuya
 */

const TUYA_ACCESS_ID = process.env.TUYA_ACCESS_ID || '';
const TUYA_ACCESS_SECRET = process.env.TUYA_ACCESS_SECRET || '';
const TUYA_MOCK = process.env.TUYA_MOCK !== 'false';
const TUYA_PULSAR_ENDPOINT = process.env.TUYA_PULSAR_ENDPOINT || 'wss://mqe.tuyacn.com:8285/';

export interface TuyaPulsarMessage {
  devId: string;
  productKey: string;
  dataId: string;
  status: Array<{ code: string; value: unknown; t: number }>;
  ts: number;
}

/**
 * 启动 Pulsar 消费者
 * TUYA_MOCK=true 时直接返回，不建立连接
 */
export async function startTuyaConsumer(
  onMessage: (msg: TuyaPulsarMessage) => Promise<void>
): Promise<{ stop: () => void }> {
  if (TUYA_MOCK) {
    console.log('[Tuya] TUYA_MOCK=true, Pulsar consumer disabled (using HTTP webhook)');
    return { stop: () => {} };
  }

  if (!TUYA_ACCESS_ID || !TUYA_ACCESS_SECRET) {
    console.warn('[Tuya] TUYA_ACCESS_ID/SECRET not configured, skipping Pulsar');
    return { stop: () => {} };
  }

  // ponytail: 真实 Pulsar 连接逻辑，待硬件到位后接入 @tuya/pulsar-mq
  // 升级步骤：
  // 1. npm install @tuya/pulsar-mq
  // 2. 用 TuyaPulsarClient 连接 TUYA_PULSAR_ENDPOINT
  // 3. 订阅 event topic，解析 status 字段转为 SensorEvent
  // 4. 调用 onMessage 回调
  console.log(`[Tuya] Pulsar consumer connecting to ${TUYA_PULSAR_ENDPOINT}...`);
  console.log(`[Tuya] accessId=${TUYA_ACCESS_ID.slice(0, 4)}***`);

  // placeholder: 实际连接实现
  let running = true;

  const stop = () => {
    running = false;
    console.log('[Tuya] Pulsar consumer stopped');
  };

  // 模拟心跳日志（生产中替换为真实 WebSocket 连接）
  const heartbeat = setInterval(() => {
    if (!running) { clearInterval(heartbeat); return; }
    console.log('[Tuya] Pulsar heartbeat ok');
  }, 60_000);

  // 确保不阻止进程退出
  if (heartbeat.unref) heartbeat.unref();

  return { stop };
}

/**
 * 解析涂鸦 Pulsar 消息为标准传感器事件参数
 * 供 onMessage 回调内部调用
 */
export function parsePulsarPayload(msg: TuyaPulsarMessage): {
  devId: string;
  status: Record<string, unknown>;
  ts: number;
} {
  const status: Record<string, unknown> = {};
  for (const s of msg.status) {
    status[s.code] = s.value;
  }
  return { devId: msg.devId, status, ts: msg.ts };
}
