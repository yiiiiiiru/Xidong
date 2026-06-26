<template>
  <van-tabbar v-model="active" fixed safe-area-inset-bottom>
    <van-tabbar-item icon="warning-o" to="/workbench">工作台</van-tabbar-item>
    <van-tabbar-item icon="friends-o" to="/elders">档案</van-tabbar-item>
    <van-tabbar-item icon="coupon-o" to="/meals">食堂</van-tabbar-item>
    <van-tabbar-item icon="user-o" to="/me">我的</van-tabbar-item>
  </van-tabbar>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const TAB_MAP: Record<string, number> = {
  '/workbench': 0,
  '/elders': 1,
  '/meals': 2,
  '/me': 3,
}

const active = ref(TAB_MAP[route.path] ?? 0)

watch(() => route.path, (path) => {
  if (path in TAB_MAP) active.value = TAB_MAP[path]
})
</script>
