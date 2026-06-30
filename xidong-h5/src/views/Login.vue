<template>
  <div class="login-page">
    <div class="logo-section">
      <div class="logo-icon">🏘️</div>
      <h1 class="app-title">溪东社区智慧养老</h1>
      <p class="app-subtitle">社区居家养老智能监护系统</p>
    </div>

    <van-cell-group inset title="选择账号登录（演示）">
      <van-cell
        v-for="account in accounts"
        :key="account.userId"
        :title="account.name"
        :label="account.desc"
        is-link
        @click="loginAs(account)"
      >
        <template #icon>
          <span class="role-emoji">{{ account.emoji }}</span>
        </template>
        <template #value>
          <van-tag :type="account.tagType" plain>{{ account.roleLabel }}</van-tag>
        </template>
      </van-cell>
    </van-cell-group>

    <p class="tip-text">提示：不同角色看到的功能和数据范围不同</p>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useUserStore, type UserRole } from '@/stores/user'
import { showToast } from 'vant'

const router = useRouter()
const userStore = useUserStore()

interface DemoAccount {
  userId: string
  name: string
  role: UserRole
  building?: string
  desc: string
  roleLabel: string
  emoji: string
  tagType: string
}

const accounts: DemoAccount[] = [
  {
    userId: 'mock_sw_001', name: '张社工', role: 'social_worker',
    desc: '告警处理 · 档案管理 · 食堂签到',
    roleLabel: '社工', emoji: '👩‍⚕️', tagType: 'primary',
  },
  {
    userId: 'mock_dir_001', name: '陈主任', role: 'director',
    desc: '全部功能 · 数据管理 · 调试开关',
    roleLabel: '主任', emoji: '👨‍💼', tagType: 'danger',
  },
  {
    userId: 'mock_bm_001', name: '王楼长', role: 'building_manager', building: '3',
    desc: '本楼告警 · 老人信息（脱敏）',
    roleLabel: '楼长', emoji: '🏠', tagType: 'warning',
  },
  {
    userId: 'mock_sw_002', name: '李备班', role: 'backup',
    desc: '备班接单 · 告警升级',
    roleLabel: '备班', emoji: '🔔', tagType: 'success',
  },
  {
    userId: 'mock_prop_001', name: '赵物业', role: 'property',
    desc: '设备维护 · 环境巡查',
    roleLabel: '物业', emoji: '🔧', tagType: 'default',
  },
]

function loginAs(account: DemoAccount) {
  userStore.mockLogin({
    userId: account.userId,
    name: account.name,
    role: account.role,
    building: account.building,
  })
  showToast(`已登录: ${account.name}（${account.roleLabel}）`)
  router.replace('/workbench')
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  background: #f7f8fa;
  padding-bottom: 40px;
}
.logo-section {
  text-align: center;
  padding: 60px 0 30px;
  background: linear-gradient(135deg, #1677ff, #4096ff);
  color: #fff;
  margin-bottom: 20px;
}
.logo-icon {
  font-size: 48px;
  margin-bottom: 12px;
}
.app-title {
  font-size: 22px;
  font-weight: 700;
  margin: 0 0 8px;
}
.app-subtitle {
  font-size: 14px;
  opacity: 0.85;
  margin: 0;
}
.role-emoji {
  font-size: 24px;
  margin-right: 10px;
}
.tip-text {
  text-align: center;
  font-size: 13px;
  color: #999;
  margin-top: 20px;
}
</style>
