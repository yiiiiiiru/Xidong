/**
 * 用户状态 (Pinia)
 * MVP 阶段: 钉钉免登获取 or fallback 到 localStorage mock
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type UserRole = 'social_worker' | 'backup' | 'building_manager' | 'director' | 'property'

export interface UserInfo {
  userId: string
  name: string
  role: UserRole
  building?: string // 楼长专属
  avatar?: string
}

export const useUserStore = defineStore('user', () => {
  const user = ref<UserInfo | null>(null)
  const token = ref<string>(localStorage.getItem('xidong_token') || '')

  const isLoggedIn = computed(() => !!user.value)
  const userId = computed(() => user.value?.userId || '')
  const role = computed(() => user.value?.role || 'social_worker')
  const building = computed(() => user.value?.building)

  /**
   * 设置用户信息 (钉钉免登成功后调用)
   */
  function setUser(info: UserInfo, authToken?: string) {
    user.value = info
    if (authToken) {
      token.value = authToken
      localStorage.setItem('xidong_token', authToken)
    }
  }

  /**
   * MVP mock 登录 — 无钉钉环境时使用
   */
  function mockLogin(preset?: Partial<UserInfo>) {
    user.value = {
      userId: preset?.userId || 'mock_sw_001',
      name: preset?.name || '张社工',
      role: preset?.role || 'social_worker',
      building: preset?.building,
      ...preset,
    }
  }

  /**
   * 登出
   */
  function logout() {
    user.value = null
    token.value = ''
    localStorage.removeItem('xidong_token')
  }

  // ponytail: 生产环境走钉钉免登，演示环境走登录页选择角色
  // 不再自动 mock，用户必须通过登录页选择账号

  return { user, token, isLoggedIn, userId, role, building, setUser, mockLogin, logout }
})
