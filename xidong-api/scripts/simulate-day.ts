/**
 * 模拟一位老人 24h 传感器事件流
 *
 * 用途：
 *   npx tsx scripts/simulate-day.ts          → 打印事件 JSON 到 stdout
 *   npx tsx scripts/simulate-day.ts --post   → 逐条 POST 到本地 webhook
 *   npx tsx scripts/simulate-day.ts --fast   → 不等待间隔，立即全部发送
 *
 * 模拟设备：
 *   - 入户门磁 (door)
 *   - 床垫压感 (bed)
 *   - 客厅 PIR (pir, location=客厅)
 *   - 卫生间 PIR (pir, location=卫生间)
 *   - 床头按钮 (button)
 *
 * 模拟场景：正常日 / 夜间离床 / 按钮报警 / 长时间无活动
 */

import type { SensorEvent, DeviceType, EventType } from '../src/types/index.js';

// ─── 配置 ───

const ELDER_ID = 'E001';
const API_BASE = process.env.API_BASE || 'http://localhost:7071';

const DEVICES = {
  door: { id: 'DEV_DOOR_001', type: 'door' as DeviceType, location: '入户门' },
  bed: { id: 'DEV_BED_001', type: 'bed' as DeviceType, location: '卧室' },
  pirLiving: { id: 'DEV_PIR_001', type: 'pir' as DeviceType, location: '客厅' },
  pirBath: { id: 'DEV_PIR_002', type: 'pir' as DeviceType, location: '卫生间' },
  button: { id: 'DEV_BTN_001', type: 'button' as DeviceType, location: '床头' },
};

// ─── 事件生成器 ───

function makeEvent(
  deviceKey: keyof typeof DEVICES,
  eventType: EventType,
  time: string, // "HH:mm"
  extraPayload: Record<string, unknown> = {}
): SensorEvent {
  const device = DEVICES[deviceKey];
  const [h, m] = time.split(':').map(Number);
  const ts = new Date();
  ts.setHours(h, m, Math.floor(Math.random() * 60), 0);

  return {
    elderId: ELDER_ID,
    deviceId: device.id,
    deviceType: device.type,
    eventType,
    payload: { location: device.location, ...extraPayload },
    ts,
  };
}

// ─── 场景定义 ───

type Scenario = { name: string; events: SensorEvent[] };

/** 正常日：早起 → 出门买菜 → 午睡 → 晚上正常就寝 */
function scenarioNormalDay(): Scenario {
  return {
    name: '正常日',
    events: [
      // 06:30 起床
      makeEvent('bed', 'off_bed', '06:30'),
      makeEvent('pirLiving', 'pir_active', '06:32'),
      makeEvent('pirBath', 'pir_active', '06:35'),
      makeEvent('pirBath', 'pir_clear', '06:45'),
      // 07:00 出门买菜
      makeEvent('door', 'door_open', '07:00'),
      makeEvent('door', 'door_close', '07:01'),
      // 07:40 回来
      makeEvent('door', 'door_open', '07:40'),
      makeEvent('door', 'door_close', '07:41'),
      makeEvent('pirLiving', 'pir_active', '07:42'),
      // 11:30 出门吃午饭
      makeEvent('door', 'door_open', '11:30'),
      makeEvent('door', 'door_close', '11:31'),
      // 12:10 回来
      makeEvent('door', 'door_open', '12:10'),
      makeEvent('door', 'door_close', '12:11'),
      // 12:30 午睡
      makeEvent('bed', 'on_bed', '12:30'),
      makeEvent('pirLiving', 'pir_clear', '12:35'),
      // 14:00 午睡起来
      makeEvent('bed', 'off_bed', '14:00'),
      makeEvent('pirLiving', 'pir_active', '14:02'),
      // 17:30 出门散步
      makeEvent('door', 'door_open', '17:30'),
      makeEvent('door', 'door_close', '17:31'),
      // 18:30 回来
      makeEvent('door', 'door_open', '18:30'),
      makeEvent('door', 'door_close', '18:31'),
      makeEvent('pirLiving', 'pir_active', '18:32'),
      // 21:30 上厕所
      makeEvent('pirBath', 'pir_active', '21:30'),
      makeEvent('pirBath', 'pir_clear', '21:40'),
      // 22:00 就寝
      makeEvent('bed', 'on_bed', '22:00'),
      makeEvent('pirLiving', 'pir_clear', '22:05'),
    ],
  };
}

/** 夜间离床场景：凌晨2点离床去厕所，30+分钟不回 → 触发 R-BED-01 */
function scenarioNightLeave(): Scenario {
  return {
    name: '夜间离床超时',
    events: [
      // 正常就寝
      makeEvent('bed', 'on_bed', '22:00'),
      makeEvent('pirLiving', 'pir_clear', '22:05'),
      // 02:00 离床
      makeEvent('bed', 'off_bed', '02:00'),
      // 客厅有人
      makeEvent('pirLiving', 'pir_active', '02:02'),
      // 厕所无人（R-BED-01 条件满足）
      // 等待超过 30min...
      // 02:35 仍在客厅
      makeEvent('pirLiving', 'pir_active', '02:35'),
    ],
  };
}

/** 夜间离床+厕所有人 → 触发 R-MIX-01 (P0) */
function scenarioMix01(): Scenario {
  return {
    name: '夜间离床+厕所滞留 (R-MIX-01)',
    events: [
      makeEvent('bed', 'on_bed', '22:00'),
      makeEvent('pirLiving', 'pir_clear', '22:05'),
      // 02:00 离床去厕所
      makeEvent('bed', 'off_bed', '02:00'),
      makeEvent('pirBath', 'pir_active', '02:02'),
      // 30+ 分钟后仍在厕所
      makeEvent('pirBath', 'pir_active', '02:35'),
    ],
  };
}

/** 按键长按报警 → 触发 R-BTN (P0, 穿透一切抑制) */
function scenarioButton(): Scenario {
  return {
    name: '一键报警 (R-BTN)',
    events: [
      makeEvent('button', 'button_hold', '14:30', { hold_sec: 3 }),
    ],
  };
}

/** 72h 无开门 → 触发 R-DOOR-01 */
function scenarioNoDoor(): Scenario {
  return {
    name: '72h未出门 (R-DOOR-01)',
    events: [
      // 仅有室内活动，无开门
      makeEvent('pirLiving', 'pir_active', '08:00'),
      makeEvent('bed', 'off_bed', '08:05'),
      makeEvent('pirBath', 'pir_active', '08:30'),
      makeEvent('pirBath', 'pir_clear', '08:40'),
      makeEvent('pirLiving', 'pir_active', '12:00'),
      makeEvent('bed', 'on_bed', '22:00'),
    ],
  };
}

/** 设备电量低 → 触发 R-DEV-02 */
function scenarioLowBattery(): Scenario {
  return {
    name: '设备电量低 (R-DEV-02)',
    events: [
      makeEvent('door', 'door_open', '10:00', { battery_pct: 15 }),
    ],
  };
}

// ─── 涂鸦 Webhook 格式转换 ───

interface TuyaWebhookPayload {
  devId: string;
  productKey: string;
  dataId: string;
  status: Array<{ code: string; value: unknown; t: number }>;
}

function toTuyaPayload(event: SensorEvent): TuyaWebhookPayload {
  const codeMap: Record<EventType, string> = {
    button_hold: 'switch_alarm',
    on_bed: 'presence_state',
    off_bed: 'presence_state',
    pir_active: 'pir',
    pir_clear: 'pir',
    door_open: 'doorcontact_state',
    door_close: 'doorcontact_state',
  };

  const valueMap: Record<EventType, unknown> = {
    button_hold: true,
    on_bed: 'presence',
    off_bed: 'none',
    pir_active: 'pir',
    pir_clear: 'none',
    door_open: true,
    door_close: false,
  };

  return {
    devId: event.deviceId,
    productKey: `PK_${event.deviceType.toUpperCase()}`,
    dataId: `${Date.now()}`,
    status: [{
      code: codeMap[event.eventType],
      value: valueMap[event.eventType],
      t: Math.floor(event.ts.getTime() / 1000),
    }],
  };
}

// ─── 主函数 ───

async function main() {
  const args = process.argv.slice(2);
  const doPost = args.includes('--post');
  const fast = args.includes('--fast');
  const scenarioName = args.find(a => !a.startsWith('--')) || 'normal';

  const scenarios: Record<string, () => Scenario> = {
    normal: scenarioNormalDay,
    night: scenarioNightLeave,
    mix01: scenarioMix01,
    button: scenarioButton,
    nodoor: scenarioNoDoor,
    battery: scenarioLowBattery,
  };

  const scenarioFn = scenarios[scenarioName];
  if (!scenarioFn) {
    console.error(`未知场景: ${scenarioName}`);
    console.error(`可用场景: ${Object.keys(scenarios).join(', ')}`);
    process.exit(1);
  }

  const scenario = scenarioFn();
  console.log(`\n📋 场景: ${scenario.name}`);
  console.log(`📊 事件数: ${scenario.events.length}`);
  console.log(`🎯 目标: ${doPost ? API_BASE : 'stdout'}\n`);

  for (const event of scenario.events) {
    const tuyaPayload = toTuyaPayload(event);

    if (doPost) {
      try {
        const resp = await fetch(`${API_BASE}/api/webhook/tuya`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(tuyaPayload),
        });
        const status = resp.ok ? '✅' : `❌ ${resp.status}`;
        console.log(`${status} [${event.ts.toTimeString().slice(0,5)}] ${event.deviceType}/${event.eventType}`);

        if (!fast) await sleep(200);
      } catch (err) {
        console.error(`❌ POST 失败:`, (err as Error).message);
      }
    } else {
      // 输出 SensorEvent + TuyaPayload 两种格式
      console.log(JSON.stringify({
        time: event.ts.toTimeString().slice(0, 5),
        sensor: event,
        tuya: tuyaPayload,
      }, null, 2));
    }
  }

  console.log(`\n✅ 完成 (${scenario.events.length} 条事件)`);
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(console.error);
