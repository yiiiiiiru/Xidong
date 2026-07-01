/**
 * 应用全局状态 (Pinia)
 * 统一管理适老模式、loading 等全局状态
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

const ELDER_MODE_KEY = 'xidong_elder_mode'

export const useAppStore = defineStore('app', () => {
  const elderMode = ref(localStorage.getItem(ELDER_MODE_KEY) === '1')

  function toggleElderMode(): boolean {
    elderMode.value = !elderMode.value
    localStorage.setItem(ELDER_MODE_KEY, elderMode.value ? '1' : '0')
    document.documentElement.classList.toggle('elder-mode', elderMode.value)
    return elderMode.value
  }

  /** 启动时应用 */
  function applyElderMode() {
    document.documentElement.classList.toggle('elder-mode', elderMode.value)
  }

  return { elderMode, toggleElderMode, applyElderMode }
})
