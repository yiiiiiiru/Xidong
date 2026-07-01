<template>
  <slot v-if="!hasError" />
  <div v-else class="error-boundary">
    <van-empty image="error" description="页面出错了">
      <van-button type="primary" size="small" @click="retry">重新加载</van-button>
    </van-empty>
  </div>
</template>

<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue'

const hasError = ref(false)
const errorInfo = ref('')

onErrorCaptured((err: Error) => {
  hasError.value = true
  errorInfo.value = err.message
  console.error('[ErrorBoundary]', err)
  return false // 阻止继续传播
})

function retry() {
  hasError.value = false
  errorInfo.value = ''
}
</script>

<style scoped>
.error-boundary {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 50vh;
  padding: 20px;
}
</style>
