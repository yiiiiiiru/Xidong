<template>
  <div class="alert-card" :class="levelBgClass" @click="$emit('click')">
    <div class="card-header">
      <van-tag :type="levelTagType" size="medium">{{ levelLabel }}</van-tag>
      <span class="rule-id">{{ alert.rule_id }}</span>
      <span class="time">{{ timeAgo }}</span>
    </div>
    <div class="card-body">
      <div class="elder-info">
        <span class="elder-name">{{ alert.elder_name }}</span>
        <span class="building">{{ alert.building }}幢</span>
      </div>
      <p class="trigger-desc">{{ alert.trigger_desc }}</p>
    </div>
    <div class="card-footer">
      <van-tag plain :type="statusTagType">{{ statusLabel }}</van-tag>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

interface AlertItem {
  id: string
  elder_name: string
  building: string
  rule_id: string
  level: 'P0' | 'P1' | 'P2'
  status: string
  trigger_desc: string
  triggered_at: string
}

const props = defineProps<{ alert: AlertItem }>()
defineEmits<{ click: [] }>()

const levelBgClass = computed(() => `level-bg-${props.alert.level.toLowerCase()}`)

const levelTagType = computed(() => {
  const map: Record<string, 'danger' | 'warning' | 'primary'> = {
    P0: 'danger',
    P1: 'warning',
    P2: 'primary',
  }
  return map[props.alert.level] || 'primary'
})

const levelLabel = computed(() => {
  const map: Record<string, string> = { P0: '紧急', P1: '注意', P2: '提示' }
  return map[props.alert.level] || props.alert.level
})

const statusLabel = computed(() => {
  const map: Record<string, string> = {
    pending: '待处理',
    processing: '处理中',
    closed: '已关闭',
    closed_false_positive: '误报关闭',
    dispatched: '已派单',
  }
  return map[props.alert.status] || props.alert.status
})

const statusTagType = computed(() => {
  const map: Record<string, 'danger' | 'warning' | 'success' | 'primary'> = {
    pending: 'danger',
    processing: 'warning',
    closed: 'success',
    dispatched: 'primary',
  }
  return map[props.alert.status] || 'primary'
})

const timeAgo = computed(() => dayjs(props.alert.triggered_at).fromNow())
</script>

<style scoped>
.alert-card {
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 10px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}
.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.rule-id {
  font-size: 12px;
  color: #999;
}
.time {
  margin-left: auto;
  font-size: 12px;
  color: #999;
}
.card-body {
  margin-bottom: 8px;
}
.elder-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.elder-name {
  font-size: 16px;
  font-weight: 600;
}
.building {
  font-size: 13px;
  color: #666;
}
.trigger-desc {
  font-size: 14px;
  color: #555;
  margin: 4px 0 0;
  line-height: 1.5;
}
.card-footer {
  display: flex;
  justify-content: flex-end;
}
</style>
