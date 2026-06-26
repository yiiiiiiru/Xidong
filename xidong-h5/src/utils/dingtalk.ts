/**
 * 钉钉 JSAPI 免登 & 工具封装
 * MVP 阶段: DEV 环境 mock，生产环境对接 dd.runtime.permission.requestAuthCode
 */
import { useUserStore } from '@/stores/user'

/** 钉钉 dd 对象类型占位 */
declare const dd: {
  ready: (fn: () => void) => void
  runtime: {
    permission: {
      requestAuthCode: (opts: {
        corpId: string
        onSuccess: (result: { code: string }) => void
        onFail: (err: unknown) => void
      }) => void
    }
  }
  biz: {
    navigation: {
      setTitle: (opts: { title: string }) => void
    }
  }
  device: {
    notification: {
      toast: (opts: { icon: string; text: string; duration: number }) => void
    }
  }
}

const CORP_ID = import.meta.env.VITE_DINGTALK_CORP_ID || 'mock_corp_id'

/**
 * 获取钉钉免登授权码
 * MVP 返回 mock code，生产环境对接 dd.runtime.permission.requestAuthCode
 */
export async function getDingTalkAuthCode(): Promise<string> {
  if (import.meta.env.DEV || !isDingTalk()) {
    console.log('[DingTalk] mock auth code')
    return 'mock_auth_code_' + Date.now()
  }

  return new Promise((resolve, reject) => {
    dd.ready(() => {
      dd.runtime.permission.requestAuthCode({
        corpId: CORP_ID,
        onSuccess: (result) => resolve(result.code),
        onFail: (err) => reject(err),
      })
    })
  })
}

/**
 * 免登流程入口：获取 authCode → 换用户信息 → 写入 store
 * MVP 阶段直接 mock 登录
 */
export async function initDingTalkLogin(): Promise<void> {
  const userStore = useUserStore()

  if (import.meta.env.DEV || !isDingTalk()) {
    // 非钉钉环境 — 使用 mock
    userStore.mockLogin()
    console.log('[DingTalk] dev mock login:', userStore.user?.name)
    return
  }

  try {
    const code = await getDingTalkAuthCode()
    // ponytail: 生产环境用 code 换 userInfo，待后端 /api/auth/dingtalk 接口实现
    // const res = await api.post('/auth/dingtalk', { code })
    // userStore.setUser(res.user, res.token)
    console.log('[DingTalk] got auth code:', code)
    userStore.mockLogin() // 临时 fallback
  } catch (err) {
    console.error('[DingTalk] login failed:', err)
    userStore.mockLogin()
  }
}

/**
 * 设置钉钉导航栏标题
 */
export function setDingTitle(title: string): void {
  if (typeof dd !== 'undefined' && dd.biz) {
    dd.biz.navigation.setTitle({ title })
  }
}

/**
 * 钉钉 toast
 */
export function dingToast(text: string, icon = 'none', duration = 2000): void {
  if (typeof dd !== 'undefined' && dd.device) {
    dd.device.notification.toast({ icon, text, duration })
  }
}

/**
 * 判断是否在钉钉环境
 */
export function isDingTalk(): boolean {
  return /DingTalk/i.test(navigator.userAgent)
}
