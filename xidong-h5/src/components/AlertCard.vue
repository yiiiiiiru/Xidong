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
      <button class="tts-btn" @click.stop="readAloud" title="语音播报">
        <svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
      </button>
      <van-tag plain :type="statusTagType">{{ statusLabel }}</van-tag>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'
import { speak } from '@/utils/accessibility'
import { getLevelTagType, getLevelLabel, getLevelBgClass, getStatusLabel, getStatusTagType } from '@/composables/useAlertMaps'

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

const levelBgClass = computed(() => getLevelBgClass(props.alert.level))
const levelTagType = computed(() => getLevelTagType(props.alert.level))
const levelLabel = computed(() => getLevelLabel(props.alert.level))
const statusLabel = computed(() => getStatusLabel(props.alert.status))
const statusTagType = computed(() => getStatusTagType(props.alert.status))

const timeAgo = computed(() => dayjs(props.alert.triggered_at).fromNow())

function readAloud() {
  const text = `${levelLabel.value}告警，${props.alert.elder_name}，${props.alert.trigger_desc}，${timeAgo.value}`
  speak(text)
}
</script>

<style scoped>
.alert-card {
  border-radius: 10px;
  padding: 14px 16px;
  margin-bottom: 12px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}
.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.rule-id {
  font-size: 13px;
  color: #666;
}
.time {
  margin-left: auto;
  font-size: 13px;
  color: #666;
}
.card-body {
  margin-bottom: 10px;
}
.elder-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.elder-name {
  font-size: 18px;
  font-weight: 600;
}
.building {
  font-size: 14px;
  color: #666;
}
.trigger-desc {
  font-size: 16px;
  color: #444;
  margin: 6px 0 0;
  line-height: 1.6;
}
.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
