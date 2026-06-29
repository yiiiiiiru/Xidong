/**
 * 适老化工具：大字模式 + 语音播报
 * ponytail: 用浏览器原生 zoom + Web Speech API，零依赖；升级路径：rem 化 + 第三方 TTS
 */

const ELDER_MODE_KEY = 'xidong_elder_mode'

/** 读取当前适老模式状态 */
export function isElderMode(): boolean {
  return localStorage.getItem(ELDER_MODE_KEY) === '1'
}

/** 切换适老模式，返回新状态 */
export function toggleElderMode(): boolean {
  const next = !isElderMode()
  localStorage.setItem(ELDER_MODE_KEY, next ? '1' : '0')
  applyElderMode(next)
  return next
}

/** 应用/移除 .elder-mode class（在 html 元素上） */
export function applyElderMode(enabled?: boolean) {
  const on = enabled ?? isElderMode()
  document.documentElement.classList.toggle('elder-mode', on)
}

/**
 * 语音播报（浏览器原生 Web Speech API）
 * 支持中文，钉钉 WebView 基于 Chrome 内核，兼容性好
 */
export function speak(text: string) {
  if (!('speechSynthesis' in window)) {
    console.warn('[TTS] 当前环境不支持语音播报')
    return
  }
  // 打断正在播报的内容
  window.speechSynthesis.cancel()

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'zh-CN'
  utterance.rate = 0.9 // 稍慢，适合老人
  utterance.pitch = 1.0
  window.speechSynthesis.speak(utterance)
}

/** 停止播报 */
export function stopSpeak() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }
}
