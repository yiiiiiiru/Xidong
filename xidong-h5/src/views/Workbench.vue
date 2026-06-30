<template>
  <div class="workbench">
    <van-nav-bar title="告警工作台" fixed placeholder />

    <van-tabs v-model:active="activeTab" sticky offset-top="46">
      <van-tab title="紧急" :badge="urgentCount || ''">
        <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
          <div class="alert-list">
            <AlertCard
              v-for="alert in urgentAlerts"
              :key="alert.id"
              :alert="alert"
              @click="goDetail(alert.id)"
            />
            <van-empty v-if="!urgentAlerts.length" description="暂无紧急告警" />
          </div>
        </van-pull-refresh>
      </van-tab>

      <van-tab title="注意" :badge="warningCount || ''">
        <div class="alert-list">
          <AlertCard
            v-for="alert in warningAlerts"
            :key="alert.id"
            :alert="alert"
            @click="goDetail(alert.id)"
          />
          <van-empty v-if="!warningAlerts.length" description="暂无注意告警" />
        </div>
      </van-tab>

      <van-tab title="已处理">
        <div class="alert-list">
          <AlertCard
            v-for="alert in closedAlerts"
            :key="alert.id"
            :alert="alert"
            @click="goDetail(alert.id)"
          />
          <van-empty v-if="!closedAlerts.length" description="暂无已处理告警" />
        </div>
      </van-tab>
    </van-tabs>

    <!-- 底部导航 -->
    <AppTabbar />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AlertCard from '@/components/AlertCard.vue'
import AppTabbar from '@/components/AppTabbar.vue'
import { alertApi, type Alert } from '@/api/index'

const router = useRouter()
const activeTab = ref(0)
const refreshing = ref(false)
const alerts = ref<Alert[]>([])
const loading = ref(false)

async function fetchAlerts() {
  loading.value = true
  try {
    const res = await alertApi.list() as unknown as { items: Alert[] }
    alerts.value = res.items || []
  } catch (err) {
    console.error('[Workbench] fetch alerts failed:', err)
  } finally {
    loading.value = false
  }
}

// ponytail: 只有 pending 才是"待处理"，其余都算"已处理"
const urgentAlerts = computed(() =>
  alerts.value.filter((a) => a.level === 'P0' && a.status === 'pending')
)
const warningAlerts = computed(() =>
  alerts.value.filter((a) => (a.level === 'P1' || a.level === 'P2') && a.status === 'pending')
)
const closedAlerts = computed(() =>
  alerts.value.filter((a) => a.status !== 'pending')
)
const urgentCount = computed(() => urgentAlerts.value.length)
const warningCount = computed(() => warningAlerts.value.length)

function goDetail(id: string) {
  router.push(`/alerts/${id}`)
}

async function onRefresh() {
  await fetchAlerts()
  refreshing.value = false
}

onMounted(() => fetchAlerts())
</script>

<style scoped>
.workbench {
  padding-bottom: 50px;
}
.alert-list {
  padding: 12px;
  min-height: 60vh;
}
</style>
