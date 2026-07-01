<template>
  <van-tabbar v-model="active" fixed safe-area-inset-bottom>
    <van-tabbar-item icon="warning-o" to="/workbench">工作台</van-tabbar-item>
    <van-tabbar-item icon="friends-o" to="/elders">档案</van-tabbar-item>
    <van-tabbar-item v-if="showMeal" icon="coupon-o" to="/meals">食堂</van-tabbar-item>
    <van-tabbar-item icon="user-o" to="/me">我的</van-tabbar-item>
  </van-tabbar>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const userStore = useUserStore()

// 楼长角色不显示食堂和档案操作（仅看告警）
const showMeal = computed(() =>
  userStore.role !== 'building_manager' && userStore.role !== 'property'
)

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
