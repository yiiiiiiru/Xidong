<template>
  <div class="elder-list">
    <van-nav-bar title="老人档案" fixed placeholder />

    <!-- 搜索栏 -->
    <van-search v-model="keyword" placeholder="搜索姓名/楼幢号" shape="round" />

    <!-- 筛选 -->
    <div class="filter-bar">
      <van-dropdown-menu>
        <van-dropdown-item v-model="filterBuilding" :options="buildingOptions" />
        <van-dropdown-item v-model="filterLevel" :options="levelOptions" />
      </van-dropdown-menu>
    </div>

    <!-- 列表 -->
    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <div class="list-content p-12">
        <van-cell-group inset>
          <van-cell
            v-for="elder in filteredList"
            :key="elder.id"
            :title="elder.name"
            :label="`${elder.building}幢${elder.room}室`"
            is-link
            @click="goDetail(elder.id)"
          >
            <template #value>
              <van-tag :type="planTagType(elder.plan_level)">
                {{ planLabel(elder.plan_level) }}
              </van-tag>
            </template>
          </van-cell>
        </van-cell-group>
        <van-empty v-if="!filteredList.length" description="暂无老人档案" />
      </div>
    </van-pull-refresh>

    <!-- 底部导航 -->
    <AppTabbar />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AppTabbar from '@/components/AppTabbar.vue'
import { elderApi, type Elder } from '@/api/index'

const router = useRouter()
const keyword = ref('')
const refreshing = ref(false)
const filterBuilding = ref('')
const filterLevel = ref('')
const elders = ref<Elder[]>([])

const buildingOptions = [
  { text: '全部楼幢', value: '' },
  { text: '3幢', value: '3' },
  { text: '5幢', value: '5' },
  { text: '7幢', value: '7' },
]

const levelOptions = [
  { text: '全部等级', value: '' },
  { text: '全护理', value: 'full' },
  { text: '标准护理', value: 'standard' },
  { text: '基础护理', value: 'basic' },
]

async function fetchElders() {
  try {
    const params: Record<string, unknown> = {}
    if (filterBuilding.value) params.building = filterBuilding.value
    if (filterLevel.value) params.plan_level = filterLevel.value
    const res = await elderApi.list(params) as unknown as { items: Elder[] }
    elders.value = res.items || []
  } catch (err) {
    console.error('[ElderList] fetch failed:', err)
  }
}

const filteredList = computed(() => {
  return elders.value.filter((e) => {
    if (keyword.value && !e.name.includes(keyword.value) && !e.building.includes(keyword.value)) return false
    return true
  })
})

function planTagType(level: string): 'danger' | 'warning' | 'primary' {
  const m: Record<string, 'danger' | 'warning' | 'primary'> = {
    full: 'danger', standard: 'warning', basic: 'primary',
  }
  return m[level] || 'primary'
}

function planLabel(level: string): string {
  const m: Record<string, string> = { full: '全护理', standard: '标准', basic: '基础' }
  return m[level] || level
}

function goDetail(id: string) {
  router.push(`/elders/${id}`)
}

async function onRefresh() {
  await fetchElders()
  refreshing.value = false
}

onMounted(() => fetchElders())
</script>

<style scoped>
.elder-list {
  padding-bottom: 60px;
}
.filter-bar {
  padding: 0 12px;
}
.list-content {
  min-height: 60vh;
}
</style>
