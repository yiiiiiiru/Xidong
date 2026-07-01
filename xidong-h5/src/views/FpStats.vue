<template>
  <div class="fp-stats-page">
    <van-nav-bar title="误报统计" left-arrow @click-left="$router.back()" fixed placeholder />

    <van-loading v-if="loading" class="page-loading" />

    <template v-else>
      <!-- 总体概览 -->
      <van-cell-group inset title="近 30 天概览">
        <van-grid :column-num="3" :border="false">
          <van-grid-item icon="warning-o" :text="`总告警 ${overview.total}`" />
          <van-grid-item icon="close" :text="`误报 ${overview.falsePositive}`" />
          <van-grid-item icon="chart-trending-o" :text="`误报率 ${fpRate}%`" />
        </van-grid>
      </van-cell-group>

      <!-- 按规则分布 -->
      <van-cell-group inset title="按规则误报分布" class="mt-8">
        <van-cell
          v-for="item in ruleBreakdown"
          :key="item.ruleId"
          :title="item.ruleId"
          :value="`${item.count} 次`"
          :label="item.label"
        />
        <van-empty v-if="!ruleBreakdown.length" description="暂无误报记录" />
      </van-cell-group>

      <!-- 按原因分布 -->
      <van-cell-group inset title="误报原因" class="mt-8">
        <van-cell
          v-for="item in reasonBreakdown"
          :key="item.reason"
          :title="item.label"
          :value="`${item.count} 次`"
        />
      </van-cell-group>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { showToast } from 'vant'
import { alertApi, type Alert, type PaginatedResponse } from '@/api/index'
import { RULE_LABELS, FP_REASON_LABELS } from '@/utils/constants'

const loading = ref(true)

const overview = ref({
  total: 0,
  falsePositive: 0,
})

const ruleBreakdown = ref<Array<{ ruleId: string; label: string; count: number }>>([])
const reasonBreakdown = ref<Array<{ reason: string; label: string; count: number }>>([])

const fpRate = computed(() => {
  if (!overview.value.total) return '0'
  return ((overview.value.falsePositive / overview.value.total) * 100).toFixed(1)
})

async function fetchStats() {
  loading.value = true
  try {
    // ponytail: MVP 从告警列表聚合，后续后端出专用接口
    const res = await alertApi.list({ status: 'closed_false_positive', page: 1, page_size: 200 }) as PaginatedResponse<Alert & { false_positive_reason?: string }>

    const allRes = await alertApi.list({ page: 1, page_size: 1 })
    overview.value = {
      total: allRes.total,
      falsePositive: res.total,
    }

    // 按规则聚合
    const ruleMap = new Map<string, number>()
    const reasonMap = new Map<string, number>()
    for (const item of res.items) {
      ruleMap.set(item.rule_id, (ruleMap.get(item.rule_id) || 0) + 1)
      const reason = item.false_positive_reason || 'other'
      reasonMap.set(reason, (reasonMap.get(reason) || 0) + 1)
    }

    ruleBreakdown.value = Array.from(ruleMap.entries())
      .map(([ruleId, count]) => ({ ruleId, label: RULE_LABELS[ruleId] || ruleId, count }))
      .sort((a, b) => b.count - a.count)

    reasonBreakdown.value = Array.from(reasonMap.entries())
      .map(([reason, count]) => ({ reason, label: FP_REASON_LABELS[reason] || reason, count }))
      .sort((a, b) => b.count - a.count)
  } catch (err) {
    console.error('[FpStats] fetch failed:', err)
    showToast('误报统计加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => fetchStats())
</script>

<style scoped>
.fp-stats-page {
  padding-bottom: 20px;
}
.page-loading {
  display: flex;
  justify-content: center;
  padding: 60px 0;
}
.mt-8 {
  margin-top: 8px;
}
</style>
