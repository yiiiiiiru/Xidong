/**
 * 钉钉 API 封装
 *
 * 1. 获取 access_token（自动缓存/续期）
 * 2. 互动卡片推送
 * 3. 语音双呼（VOICE_MOCK=true 时仅打日志）
 *
 * @module services/dingtalk
 */

const APP_KEY = process.env.DINGTALK_APP_KEY || '';
const APP_SECRET = process.env.DINGTALK_APP_SECRET || '';
const AGENT_ID = process.env.DINGTALK_AGENT_ID || '';
const VOICE_MOCK = process.env.VOICE_MOCK === 'true';

const DINGTALK_API = 'https://oapi.dingtalk.com';

// ─── Token 管理 ───

let tokenCache: { token: string; expiresAt: number } | null = null;

export async function getAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }

  if (!APP_KEY || !APP_SECRET) {
    console.warn('[DingTalk] APP_KEY/APP_SECRET not configured, returning mock token');
    return 'mock_access_token';
  }

  const url = `${DINGTALK_API}/gettoken?appkey=${APP_KEY}&appsecret=${APP_SECRET}`;
  const resp = await fetch(url);
  const data = await resp.json() as { errcode: number; access_token: string; expires_in: number };

  if (data.errcode !== 0) {
    throw new Error(`DingTalk gettoken failed: ${data.errcode}`);
  }

  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 300) * 1000, // 提前 5min 刷新
  };

  return tokenCache.token;
}

// ─── 互动卡片推送 ───

export interface CardMessage {
  outTrackId: string;      // alertId
  userIdList: string[];    // 推送给谁
  title: string;
  markdown: string;
  btnOrientation?: '0' | '1';
  btns: Array<{ title: string; actionURL: string }>;
}

export async function sendInteractiveCard(msg: CardMessage): Promise<boolean> {
  const token = await getAccessToken();
  if (token === 'mock_access_token') {
    console.log(`[DingTalk] mock card → ${msg.userIdList.join(',')}: ${msg.title}`);
    return true;
  }

  const url = `${DINGTALK_API}/topapi/message/corpconversation/asyncsend_v2?access_token=${token}`;
  const body = {
    agent_id: AGENT_ID,
    userid_list: msg.userIdList.join(','),
    msg: {
      msgtype: 'action_card',
      action_card: {
        title: msg.title,
        markdown: msg.markdown,
        btn_orientation: msg.btnOrientation || '1',
        btn_json_list: msg.btns.map(b => ({
          title: b.title,
          action_url: b.actionURL,
        })),
      },
    },
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const result = await resp.json() as { errcode: number; errmsg: string };
  if (result.errcode !== 0) {
    console.error(`[DingTalk] card send failed: ${result.errcode} ${result.errmsg}`);
    return false;
  }

  return true;
}

// ─── 语音双呼 ───

export interface VoiceCallParams {
  callerPhone: string;     // 社工手机
  calleePhone: string;     // 物业 24h / 备班手机
  alertId: string;
}

export async function initiateVoiceCall(params: VoiceCallParams): Promise<boolean> {
  if (VOICE_MOCK) {
    console.log(`[DingTalk] VOICE_MOCK → 双呼: ${params.callerPhone} ↔ ${params.calleePhone} (alert: ${params.alertId})`);
    return true;
  }

  // ponytail: 真实语音双呼需要钉钉智能外呼 API (企业版)，此处预留接口
  // 生产实现: POST /topapi/smartwork/hrm/employee/voice_call
  console.warn('[DingTalk] real voice call not implemented, falling back to mock');
  return false;
}

// ─── 用户信息查询 ───

export async function getUserInfo(authCode: string): Promise<{
  userId: string;
  name: string;
  avatar?: string;
} | null> {
  const token = await getAccessToken();
  if (token === 'mock_access_token') {
    return { userId: 'mock_user', name: 'Mock用户' };
  }

  const url = `${DINGTALK_API}/topapi/v2/user/getuserinfo?access_token=${token}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: authCode }),
  });

  const data = await resp.json() as { errcode: number; result?: { userid: string; name: string; avatar?: string } };
  if (data.errcode !== 0 || !data.result) {
    console.error('[DingTalk] getUserInfo failed:', data);
    return null;
  }

  return {
    userId: data.result.userid,
    name: data.result.name,
    avatar: data.result.avatar,
  };
}
