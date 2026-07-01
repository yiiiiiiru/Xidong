<template>
  <div class="timeline-wrap">
    <div
      v-for="(item, idx) in items"
      :key="idx"
      class="tl-item"
      :class="{ 'tl-item--last': idx === items.length - 1 }"
    >
      <div class="tl-dot" :class="dotClass(item.event)" />
      <div class="tl-line" v-if="idx < items.length - 1" />
      <div class="tl-content">
        <p class="tl-label">{{ labelText(item) }}</p>
        <p class="tl-time">{{ formatTime(item.ts) }}</p>
      </div>
    </div>
    <van-empty v-if="!items.length" description="暂无处理记录" image="search" />
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs'

export interface TimelineItem {
  event: string
  ts: string
  operator?: string
  note?: string
  channel?: string
}

defineProps<{
  items: TimelineItem[]
}>()

const EVENT_LABELS: Record<string, string> = {
  triggered: '系统触发告警',
  pushed: '已推送通知',
  acknowledged: '已确认接单',
  suppressed: '已被抑制',
  escalated: '已升级',
  closed: '已关闭',
  dispatched: '已派单',
}

function labelText(item: TimelineItem): string {
  let text = EVENT_LABELS[item.event] || item.event
  if (item.operator) text += ` (${item.operator})`
  if (item.note) text += `：${item.note}`
  if (item.channel) text += ` [${item.channel}]`
  return text
}

function formatTime(ts: string): string {
  return dayjs(ts).format('MM-DD HH:mm:ss')
}

function dotClass(event: string): string {
  if (event === 'triggered') return 'tl-dot--danger'
  if (event === 'acknowledged' || event === 'dispatched') return 'tl-dot--warning'
  if (event === 'closed') return 'tl-dot--success'
  return ''
}
</script>

<style scoped>
.timeline-wrap {
  position: relative;
  padding-left: 20px;
}
.tl-item {
  position: relative;
  padding-bottom: 16px;
  padding-left: 16px;
}
.tl-item--last {
  padding-bottom: 0;
}
.tl-dot {
  position: absolute;
  left: -6px;
  top: 4px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #ddd;
  border: 2px solid #fff;
  box-shadow: 0 0 0 1px #ddd;
}
.tl-dot--danger {
  background: var(--van-danger-color, #ee0a24);
  box-shadow: 0 0 0 1px var(--van-danger-color, #ee0a24);
}
.tl-dot--warning {
  background: var(--van-warning-color, #ff976a);
  box-shadow: 0 0 0 1px var(--van-warning-color, #ff976a);
}
.tl-dot--success {
  background: var(--van-success-color, #07c160);
  box-shadow: 0 0 0 1px var(--van-success-color, #07c160);
}
.tl-line {
  position: absolute;
  left: -1px;
  top: 18px;
  bottom: 0;
  width: 2px;
  background: #eee;
}
.tl-content {
  min-height: 20px;
}
.tl-label {
  font-size: 14px;
  color: #333;
  margin: 0 0 2px;
  line-height: 1.4;
}
.tl-time {
  font-size: 13px;
  color: #666;
  margin: 0;
}
</style>
