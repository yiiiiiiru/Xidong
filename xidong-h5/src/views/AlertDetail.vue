<template>
  <div class="alert-detail">
    <van-nav-bar title="告警详情" left-arrow @click-left="router.back()" fixed placeholder />

    <div class="detail-content p-12">
      <!-- 告警卡片头 -->
      <div class="detail-card" :class="levelBgClass">
        <div class="detail-header">
          <van-tag :type="levelTagType" size="large">{{ levelLabel }}</van-tag>
          <span class="detail-rule">{{ alert.rule_id }}</span>
          <van-tag plain :type="statusType">{{ statusLabel }}</van-tag>
        </div>

        <div class="elder-row">
          <van-icon name="user-o" />
          <span class="elder-name">{{ alert.elder_name }}</span>
          <span class="building-info">{{ alert.building }}幢</span>
        </div>

        <p class="trigger-desc">{{ alert.trigger_desc }}</p>
        <p class="trigger-time">触发时间：{{ formattedTime }}</p>
      </div>

      <!-- 处理时间线 -->
      <div class="section">
        <h3 class="section-title">处理记录</h3>
        <Timeline :items="alert.timeline || []" />
      </div>

      <!-- 操作按钮 -->
      <div class="action-bar" v-if="alert.status === 'pending' || alert.status === 'processing'">
        <van-button type="primary" block @click="showActionSheet = true">
          处理告警
        </van-button>
      </div>
    </div>

    <!-- 处理动作面板 -->
    <van-action-sheet
      v-model:show="showActionSheet"
      title="选择处理方式"
      :actions="actionOptions"
      @select="onAction"
      cancel-text="取消"
    />

    <!-- 误报原因弹窗 -->
    <van-dialog
      v-model:show="showFpDialog"
      title="标记误报"
      show-cancel-button
      @confirm="onConfirmFp"
    >
      <div class="fp-dialog-body">
        <van-field
          v-model="fpReason"
          type="textarea"
          placeholder="请输入误报原因"
          rows="3"
          autosize
        />
      </div>
    </van-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import dayjs from 'dayjs'
import { alertApi, type Alert } from '@/api/index'
import Timeline from '@/components/Timeline.vue'
import { getLevelLabel, getLevelTagType, getLevelBgClass, getStatusLabel, getStatusTagType } from '@/composables/useAlertMaps'

const route = useRoute()
const router = useRouter()
const alertId = route.params.id as string

const showActionSheet = ref(false)
const showFpDialog = ref(false)
const fpReason = ref('')
const loading = ref(false)

const alert = ref<Alert & { timeline?: Array<{ event: string; ts: string; operator?: string; note?: string }> }>({
  id: alertId,
  elder_id: '',
  elder_name: '',
  building: '',
  rule_id: '',
  level: 'P1',
  status: 'pending',
  trigger_desc: '',
  triggered_at: '',
})

async function fetchDetail() {
  loading.value = true
  try {
    const res = await alertApi.detail(alertId)
    alert.value = res
  } catch (err) {
    console.error('[AlertDetail] fetch failed:', err)
    showToast('告警详情加载失败')
  } finally {
    loading.value = false
  }
}

const levelBgClass = computed(() => getLevelBgClass(alert.value.level))
const levelTagType = computed(() => getLevelTagType(alert.value.level))
const levelLabel = computed(() => getLevelLabel(alert.value.level))
const statusLabel = computed(() => getStatusLabel(alert.value.status))
const statusType = computed(() => getStatusTagType(alert.value.status))
const formattedTime = computed(() => dayjs(alert.value.triggered_at).format('YYYY-MM-DD HH:mm:ss'))

const actionOptions = computed(() => {
  if (alert.value.status === 'pending') {
    return [
      { name: '确认并处理', value: 'acknowledge' },
      { name: '误报关闭', value: 'false_positive' },
    ]
  }
  return [
    { name: '安全关闭', value: 'safe' },
    { name: '误报关闭', value: 'false_positive' },
    { name: '派单给楼长', value: 'dispatch' },
  ]
})

const ACTION_TO_STATUS: Record<string, string> = {
  acknowledge: 'processing',
  safe: 'closed',
  false_positive: 'closed_false_positive',
  dispatch: 'dispatched',
  visit_done: 'closed',
}

async function onAction(action: { value: string }) {
  showActionSheet.value = false
  if (action.value === 'false_positive') {
    showFpDialog.value = true
    return
  }
  const prevStatus = alert.value.status
  try {
    // 乐观更新
    alert.value.status = ACTION_TO_STATUS[action.value] || alert.value.status
    await alertApi.handle(alertId, { action: action.value })
    showToast('操作成功')
    setTimeout(() => router.replace('/workbench'), 1200)
  } catch (err) {
    // 回滚
    alert.value.status = prevStatus
    showToast('操作失败')
  }
}

async function onConfirmFp() {
  try {
    await alertApi.handle(alertId, {
      action: 'false_positive',
      false_positive_reason: fpReason.value || 'other',
      note: fpReason.value,
    })
    alert.value.status = 'closed_false_positive'
    showToast('已标记误报')
    fpReason.value = ''
    setTimeout(() => router.replace('/workbench'), 1200)
  } catch (err) {
    showToast('操作失败')
  }
}

onMounted(() => fetchDetail())
</script>

<style scoped>
.detail-content {
  padding-bottom: 80px;
}
.detail-card {
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}
.detail-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.detail-rule {
  font-size: 13px;
  color: #666;
}
.elder-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}
.elder-name {
  font-size: 16px;
  font-weight: 600;
}
.building-info {
  font-size: 13px;
  color: #666;
}
.trigger-desc {
  font-size: 15px;
  line-height: 1.6;
  color: #333;
  margin: 0 0 4px;
}
.trigger-time {
  font-size: 13px;
  color: #666;
  margin: 0;
}
.section {
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}
.section-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 12px;
}
.step-text {
  font-size: 14px;
  margin: 0 0 2px;
}
.step-time {
  font-size: 12px;
  color: #999;
  margin: 0;
}
.action-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 12px 16px;
  padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
  background: #fff;
  box-shadow: 0 -1px 4px rgba(0,0,0,0.06);
}
.fp-dialog-body {
  padding: 12px 16px 0;
}
</style>
