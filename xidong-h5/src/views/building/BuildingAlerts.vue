<template>
  <div class="building-alerts">
    <van-nav-bar title="楼长告警" left-arrow @click-left="router.back()" fixed placeholder />

    <div class="info-bar">
      <van-notice-bar left-icon="volume-o" text="您仅可查看所负责楼幢的告警（已脱敏）" />
    </div>

    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <div class="list-content p-12">
        <div v-for="alert in alerts" :key="alert.id" class="building-alert-card" :class="levelBg(alert.level)">
          <div class="ba-header">
            <van-tag :type="levelType(alert.level)">{{ levelText(alert.level) }}</van-tag>
            <span class="ba-rule">{{ alert.rule_id }}</span>
            <span class="ba-time">{{ alert.triggered_at }}</span>
          </div>
          <div class="ba-body">
            <span class="ba-elder">{{ alert.elder_name }}</span>
            <span class="ba-room">{{ alert.building }}幢{{ alert.room }}</span>
          </div>
          <p class="ba-desc">{{ alert.trigger_desc }}</p>
        </div>
        <van-empty v-if="!alerts.length" description="暂无告警" />
      </div>
    </van-pull-refresh>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { getLevelTagType, getLevelLabel, getLevelBgClass } from '@/composables/useAlertMaps'

const router = useRouter()
const refreshing = ref(false)

// Mock — 楼长视角数据（脱敏后无手机号、无慢性病）
const alerts = ref([
  {
    id: '2001', elder_name: '张阿婆', building: '3', room: '301',
    rule_id: 'R-BTN', level: 'P0', trigger_desc: '床头一键报警长按触发',
    triggered_at: '14:30',
  },
  {
    id: '2002', elder_name: '王奶奶', building: '3', room: '303',
    rule_id: 'R-MIX-01', level: 'P1', trigger_desc: '12h 内无开门+无人体活动',
    triggered_at: '06:00',
  },
])

function levelType(l: string) { return getLevelTagType(l) }
function levelText(l: string) { return getLevelLabel(l) }
function levelBg(l: string) { return getLevelBgClass(l) }
function onRefresh() {
  setTimeout(() => { refreshing.value = false }, 800)
}
</script>

<style scoped>
.building-alerts {
  padding-bottom: 20px;
}
.info-bar {
  margin-bottom: 8px;
}
.list-content {
  min-height: 60vh;
}
.building-alert-card {
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 10px;
}
.ba-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.ba-rule { font-size: 12px; color: #999; }
.ba-time { margin-left: auto; font-size: 12px; color: #999; }
.ba-body {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.ba-elder { font-size: 16px; font-weight: 600; }
.ba-room { font-size: 13px; color: #666; }
.ba-desc {
  font-size: 14px;
  color: #555;
  margin: 0;
  line-height: 1.5;
}
</style>
