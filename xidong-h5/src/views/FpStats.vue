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
import { alertApi } from '@/api/index'

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

const RULE_LABELS: Record<string, string> = {
  'R-BTN': '一键报警',
  'R-MIX-01': '夜间离床+厕所',
  'R-MIX-02': '应睡未睡+未出门',
  'R-BED-01': '夜间离床',
  'R-BED-02': '应睡未睡',
  'R-BED-03': '整夜在床不足',
  'R-BED-04': '连续在床',
  'R-BATH-01': '卫生间滞留',
  'R-DOOR-01': '72h未出门',
  'R-DOOR-02': '门长开',
  'R-DEV-01': '设备离线',
  'R-DEV-02': '电量低',
}

const REASON_LABELS: Record<string, string> = {
  bathing: '洗澡',
  visitor: '有客人',
  pet: '宠物触发',
  device_fault: '设备故障',
  other: '其他',
}

async function fetchStats() {
  loading.value = true
  try {
    // ponytail: MVP 从告警列表聚合，后续后端出专用接口
    const res = await alertApi.list({ status: 'closed_false_positive', page: 1, page_size: 200 }) as unknown as {
      items: Array<{ rule_id: string; false_positive_reason?: string }>
      total: number
    }

    const allRes = await alertApi.list({ page: 1, page_size: 1 }) as unknown as { total: number }
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
      .map(([reason, count]) => ({ reason, label: REASON_LABELS[reason] || reason, count }))
      .sort((a, b) => b.count - a.count)
  } catch (err) {
    console.error('[FpStats] fetch failed:', err)
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
