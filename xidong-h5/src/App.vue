<template>
  <div class="app-root">
    <!-- 全局网络状态提示 -->
    <van-notice-bar
      v-if="offline"
      left-icon="warning-o"
      text="网络已断开，部分功能可能不可用"
      color="#fff"
      background="#ee0a24"
      class="offline-bar"
    />
    <ErrorBoundary>
      <router-view v-slot="{ Component }">
        <transition name="page-fade" mode="out-in">
          <component :is="Component" :key="$route.fullPath" />
        </transition>
      </router-view>
    </ErrorBoundary>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useAppStore } from '@/stores/app'
import ErrorBoundary from '@/components/ErrorBoundary.vue'

// 启动时恢复适老模式状态
const appStore = useAppStore()
appStore.applyElderMode()

// 全局网络状态监听
const offline = ref(!navigator.onLine)

function handleOnline() { offline.value = false }
function handleOffline() { offline.value = true }

onMounted(() => {
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
})

onUnmounted(() => {
  window.removeEventListener('online', handleOnline)
  window.removeEventListener('offline', handleOffline)
})
</script>

<style scoped>
.offline-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 9999;
}
</style>

<style>
/* 页面过渡动画 */
.page-fade-enter-active,
.page-fade-leave-active {
  transition: opacity 0.2s ease;
}
.page-fade-enter-from,
.page-fade-leave-to {
  opacity: 0;
}
</style>
