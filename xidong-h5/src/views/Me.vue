<template>
  <div class="me-page">
    <van-nav-bar title="个人中心" fixed placeholder />

    <div class="user-card">
      <van-image round width="56px" height="56px" src="https://img.yzcdn.cn/vant/cat.jpeg" />
      <div class="user-info">
        <span class="user-name">{{ userInfo.name }}</span>
        <van-tag type="primary">{{ roleLabel }}</van-tag>
      </div>
    </div>

    <!-- 我的统计 -->
    <van-cell-group inset title="本周统计">
      <van-grid :column-num="3" :border="false">
        <van-grid-item icon="warning-o" :text="`待处理 ${stats.pending}`" />
        <van-grid-item icon="clock-o" :text="`处理中 ${stats.processing}`" />
        <van-grid-item icon="checked" :text="`已关闭 ${stats.closed}`" />
      </van-grid>
    </van-cell-group>

    <!-- 功能列表 -->
    <van-cell-group inset title="功能" class="mt-8">
      <van-cell title="我负责的老人" is-link to="/elders" icon="friends-o" />
      <van-cell title="误报统计" is-link to="/me/fp-stats" icon="chart-trending-o" />
      <van-cell title="系统设置" is-link icon="setting-o" @click="showToast('TODO: 系统设置页')" />
    </van-cell-group>

    <!-- 降级开关（仅管理员可见，MVP调试用） -->
    <van-cell-group inset title="调试开关（MVP）" class="mt-8">
      <van-cell title="VOICE_MOCK" label="语音双呼 mock 模式">
        <template #right-icon>
          <van-switch v-model="switches.voiceMock" size="20px" />
        </template>
      </van-cell>
      <van-cell title="BASELINE_FIXED" label="固定基线（跳过动态计算）">
        <template #right-icon>
          <van-switch v-model="switches.baselineFixed" size="20px" />
        </template>
      </van-cell>
      <van-cell title="TUYA_MOCK" label="涂鸦设备 mock 模式">
        <template #right-icon>
          <van-switch v-model="switches.tuyaMock" size="20px" />
        </template>
      </van-cell>
    </van-cell-group>

    <!-- 底部导航 -->
    <AppTabbar />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { showToast } from 'vant'
import AppTabbar from '@/components/AppTabbar.vue'
import { statsApi } from '@/api/index'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()

const userInfo = computed(() => ({
  name: userStore.user?.name || '未登录',
  role: userStore.role || 'social_worker',
  userId: userStore.userId || '',
}))

const roleLabel = computed(() => {
  const m: Record<string, string> = {
    social_worker: '社工',
    backup: '值班人',
    building_manager: '楼长',
    director: '主任',
    property: '物业',
  }
  return m[userInfo.value.role] || userInfo.value.role
})

const stats = ref({
  pending: 0,
  processing: 0,
  closed: 0,
  totalElders: 0,
})

async function fetchStats() {
  try {
    const res = await statsApi.me() as unknown as {
      pending_count: number; processing_count: number;
      closed_today: number; total_elders: number;
    }
    stats.value = {
      pending: res.pending_count,
      processing: res.processing_count,
      closed: res.closed_today,
      totalElders: res.total_elders,
    }
  } catch (err) {
    console.error('[Me] fetch stats failed:', err)
  }
}

// MVP 降级开关
const switches = ref({
  voiceMock: true,
  baselineFixed: true,
  tuyaMock: true,
})

onMounted(() => fetchStats())
</script>

<style scoped>
.me-page {
  padding-bottom: 60px;
}
.user-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 16px;
  background: linear-gradient(135deg, #1677ff, #4096ff);
  color: #fff;
}
.user-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.user-name {
  font-size: 18px;
  font-weight: 600;
}
</style>
