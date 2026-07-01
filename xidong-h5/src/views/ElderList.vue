<template>
  <div class="elder-list">
    <van-nav-bar :title="isDirector ? '全部老人' : '我负责的老人'" fixed placeholder />

    <!-- 搜索栏 -->
    <van-search v-model="keyword" placeholder="搜索姓名/楼幢号" shape="round" />

    <!-- 筛选 -->
    <div class="filter-bar">
      <van-dropdown-menu>
        <van-dropdown-item v-model="filterBuilding" :options="buildingOptions" />
        <van-dropdown-item v-model="filterLevel" :options="levelOptions" />
      </van-dropdown-menu>
    </div>

    <!-- Loading 骨架屏 -->
    <div v-if="loading" class="list-content p-12">
      <van-skeleton title :row="2" v-for="i in 5" :key="i" class="skeleton-item" />
    </div>

    <!-- 列表 -->
    <van-pull-refresh v-else v-model="refreshing" @refresh="onRefresh">
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
              <div class="cell-right">
                <div v-if="elder.assignments && elder.assignments.length" class="assign-tags">
                  <van-tag v-for="a in elder.assignments" :key="a.worker_id" plain type="primary" class="assign-tag">
                    {{ a.role ? `${a.role}: ${a.worker_name}` : a.worker_name }}
                  </van-tag>
                </div>
                <van-tag :type="planTagType(elder.plan_level)">
                  {{ planLabel(elder.plan_level) }}
                </van-tag>
              </div>
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
import { showToast } from 'vant'
import AppTabbar from '@/components/AppTabbar.vue'
import { elderApi, assignmentApi, type Elder } from '@/api/index'
import { useUserStore } from '@/stores/user'
import { BUILDING_OPTIONS, PLAN_LEVEL_OPTIONS } from '@/utils/constants'
import { useDebouncedRef } from '@/composables/useDebounce'

const router = useRouter()
const userStore = useUserStore()
const isDirector = computed(() => userStore.role === 'director')

const keyword = ref('')
const debouncedKeyword = useDebouncedRef(keyword, 300)
const refreshing = ref(false)
const loading = ref(true)
const filterBuilding = ref('')
const filterLevel = ref('')
const elders = ref<Elder[]>([])

const buildingOptions = BUILDING_OPTIONS
const levelOptions = PLAN_LEVEL_OPTIONS

async function fetchElders() {
  loading.value = true
  try {
    if (isDirector.value) {
      // 主任看全部
      const params: Record<string, unknown> = {}
      if (filterBuilding.value) params.building = filterBuilding.value
      if (filterLevel.value) params.plan_level = filterLevel.value
      const res = await elderApi.list(params)
      elders.value = res.items || []
    } else {
      // 其他角色只看自己负责的
      const res = await assignmentApi.myElders()
      elders.value = (res.items || []).map(item => ({
        id: item.elder_id || item.id,
        name: item.elder_name || item.name,
        gender: item.gender || '',
        age: item.age || 0,
        building: item.building || '',
        unit: item.unit || '',
        room: item.room || '',
        risk_class: item.risk_class || 'C',
        plan_level: item.plan_level || 'basic',
        assignments: item.assignments,
      }))
    }
  } catch (err) {
    console.error('[ElderList] fetch failed:', err)
    showToast('老人档案加载失败')
  } finally {
    loading.value = false
  }
}

const filteredList = computed(() => {
  return elders.value.filter((e) => {
    if (debouncedKeyword.value && !e.name.includes(debouncedKeyword.value) && !e.building?.includes(debouncedKeyword.value)) return false
    if (!isDirector.value) return true
    if (filterBuilding.value && e.building !== filterBuilding.value) return false
    if (filterLevel.value && e.plan_level !== filterLevel.value) return false
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
.skeleton-item {
  padding: 12px 16px;
  margin-bottom: 8px;
}
.cell-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}
.assign-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  justify-content: flex-end;
}
.assign-tag {
  font-size: 11px;
}
</style>
