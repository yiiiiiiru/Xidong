/**
 * 初始化 Mock 设备映射数据到 Redis
 *
 * 用法: npx tsx scripts/seed-mock.ts
 *
 * 创建 5 位老人 × 5 个设备 = 25 条设备映射
 * 同时设置每位老人的基础状态
 */

const API_BASE = process.env.API_BASE || 'http://localhost:7071';

interface DeviceSeed {
  devId: string;
  elderId: string;
  deviceType: string;
  location: string;
}

// 5 位测试老人的设备配置
const ELDERS = [
  { id: 'E001', name: '张阿婆', building: '3', room: '301' },
  { id: 'E002', name: '李大爷', building: '5', room: '502' },
  { id: 'E003', name: '王奶奶', building: '3', room: '303' },
  { id: 'E004', name: '赵伯伯', building: '7', room: '701' },
  { id: 'E005', name: '陈阿姨', building: '5', room: '503' },
];

function generateDevices(): DeviceSeed[] {
  const devices: DeviceSeed[] = [];

  for (const elder of ELDERS) {
    const prefix = `DEV_${elder.id}_`;
    devices.push(
      { devId: `${prefix}DOOR`, elderId: elder.id, deviceType: 'door', location: '入户门' },
      { devId: `${prefix}BED`, elderId: elder.id, deviceType: 'bed', location: '卧室' },
      { devId: `${prefix}PIR_LR`, elderId: elder.id, deviceType: 'pir', location: '客厅' },
      { devId: `${prefix}PIR_BR`, elderId: elder.id, deviceType: 'pir', location: '卫生间' },
      { devId: `${prefix}BTN`, elderId: elder.id, deviceType: 'button', location: '床头' },
    );
  }

  return devices;
}

async function main() {
  const devices = generateDevices();

  console.log(`\n🔧 初始化 ${devices.length} 条设备映射...\n`);

  try {
    const resp = await fetch(`${API_BASE}/api/internal/seed-devices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ devices }),
    });

    if (resp.ok) {
      const result = await resp.json();
      console.log(`✅ 设备映射完成:`, result);
    } else {
      console.error(`❌ 请求失败: ${resp.status}`);
      console.error(await resp.text());
    }
  } catch (err) {
    console.error(`❌ 无法连接 API (${API_BASE}):`, (err as Error).message);
    console.log('\n💡 请先启动后端: cd xidong-api && npm start');
  }

  // 打印设备列表供参考
  console.log('\n📋 设备映射表:');
  console.log('─'.repeat(70));
  console.log(`${'devId'.padEnd(20)} ${'elderId'.padEnd(8)} ${'type'.padEnd(8)} location`);
  console.log('─'.repeat(70));
  for (const d of devices) {
    console.log(`${d.devId.padEnd(20)} ${d.elderId.padEnd(8)} ${d.deviceType.padEnd(8)} ${d.location}`);
  }
}

main().catch(console.error);
