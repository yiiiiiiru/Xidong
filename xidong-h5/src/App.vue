<template>
  <router-view />
</template>

<script setup lang="ts">
import { applyElderMode } from '@/utils/accessibility'

// 启动时恢复适老模式状态
applyElderMode()
</script>
