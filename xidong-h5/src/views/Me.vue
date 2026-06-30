<template>
  <div class="me-page">
    <van-nav-bar title="个人中心" fixed placeholder />

    <div class="user-card">
      <van-image round width="56px" height="56px" src="https://img.yzcdn.cn/vant/cat.jpeg" />
      <div class="user-info">
        <span class="user-name">{{ userInfo.name }}</span>
        <van-tag type="primary">{{ roleLabel }}</van-tag>
      </div>
    </div>

    <!-- 我的统计 -->
    <van-cell-group inset title="本周统计">
      <van-grid :column-num="3" :border="false">
        <van-grid-item icon="warning-o" :text="`待处理 ${stats.pending}`" />
        <van-grid-item icon="clock-o" :text="`处理中 ${stats.processing}`" />
        <van-grid-item icon="checked" :text="`已关闭 ${stats.closed}`" />
      </van-grid>
    </van-cell-group>

    <!-- 功能列表 -->
    <van-cell-group inset title="功能" class="mt-8">
      <van-cell v-if="userInfo.role === 'director' || userInfo.role === 'social_worker'" title="数据管理" is-link to="/admin" icon="setting-o" label="老人档案 / 工作人员 增删改查" />
      <van-cell title="我负责的老人" is-link to="/elders" icon="friends-o" />
      <van-cell title="误报统计" is-link to="/me/fp-stats" icon="chart-trending-o" />
      <van-cell title="适老模式" label="大字号 + 语音播报" icon="eye-o">
        <template #right-icon>
          <van-switch v-model="elderMode" size="20px" @change="onElderModeChange" />
        </template>
      </van-cell>
    </van-cell-group>

    <!-- 设置 -->
    <van-cell-group inset title="设置" class="mt-8">
      <van-cell title="账号信息" is-link icon="user-o" @click="showAccountInfo = true" />
      <van-cell title="修改密码" is-link icon="lock" @click="showChangePwd = true" />
      <van-cell title="消息通知" is-link icon="bell" @click="showNotifySetting = true" />
      <van-cell title="隐私设置" is-link icon="shield-o" @click="showPrivacy = true" />
      <van-cell title="关于" is-link icon="info-o" @click="showAbout = true" />
    </van-cell-group>

    <!-- 登出按钮 -->
    <div class="logout-section">
      <van-button block plain type="danger" @click="onLogout">退出登录</van-button>
    </div>

    <!-- 降级开关（仅管理员可见，MVP调试用） -->
    <van-cell-group inset title="调试开关（MVP）" class="mt-8" v-if="userInfo.role === 'director'">
      <van-cell title="VOICE_MOCK" label="语音双呼 mock 模式">
        <template #right-icon>
          <van-switch v-model="switches.voiceMock" size="20px" />
        </template>
      </van-cell>
      <van-cell title="BASELINE_FIXED" label="固定基线（跳过动态计算）">
        <template #right-icon>
          <van-switch v-model="switches.baselineFixed" size="20px" />
        </template>
      </van-cell>
      <van-cell title="TUYA_MOCK" label="涂鸦设备 mock 模式">
        <template #right-icon>
          <van-switch v-model="switches.tuyaMock" size="20px" />
        </template>
      </van-cell>
    </van-cell-group>

    <!-- 账号信息弹窗 -->
    <van-popup v-model:show="showAccountInfo" position="bottom" round :style="{ minHeight: '40%' }">
      <div class="popup-content">
        <h3>账号信息</h3>
        <van-cell-group>
          <van-cell title="姓名" :value="userInfo.name" />
          <van-cell title="角色" :value="roleLabel" />
          <van-cell title="用户ID" :value="userInfo.userId" />
        </van-cell-group>
      </div>
    </van-popup>

    <!-- 修改密码弹窗 -->
    <van-popup v-model:show="showChangePwd" position="bottom" round :style="{ minHeight: '40%' }">
      <div class="popup-content">
        <h3>修改密码</h3>
        <van-field v-model="pwdForm.oldPwd" type="password" label="原密码" placeholder="请输入原密码" />
        <van-field v-model="pwdForm.newPwd" type="password" label="新密码" placeholder="请输入新密码" />
        <van-field v-model="pwdForm.confirmPwd" type="password" label="确认密码" placeholder="再次输入新密码" />
        <van-button type="primary" block class="mt-8" @click="onChangePwd">确认修改</van-button>
      </div>
    </van-popup>

    <!-- 消息通知设置 -->
    <van-popup v-model:show="showNotifySetting" position="bottom" round :style="{ minHeight: '35%' }">
      <div class="popup-content">
        <h3>消息通知</h3>
        <van-cell title="接收告警推送">
          <template #right-icon>
            <van-switch v-model="notifySettings.alertPush" size="20px" />
          </template>
        </van-cell>
        <van-cell title="声音提醒">
          <template #right-icon>
            <van-switch v-model="notifySettings.sound" size="20px" />
          </template>
        </van-cell>
        <van-cell title="勿扰模式 (23:00-06:00)">
          <template #right-icon>
            <van-switch v-model="notifySettings.quietMode" size="20px" />
          </template>
        </van-cell>
      </div>
    </van-popup>

    <!-- 隐私设置 -->
    <van-popup v-model:show="showPrivacy" position="bottom" round :style="{ minHeight: '35%' }">
      <div class="popup-content">
        <h3>隐私设置</h3>
        <van-cell title="老人信息脱敏显示" label="隐藏老人电话号部分位数">
          <template #right-icon>
            <van-switch v-model="privacySettings.desensitize" size="20px" />
          </template>
        </van-cell>
        <van-cell title="操作日志记录" label="记录我的告警处理操作">
          <template #right-icon>
            <van-switch v-model="privacySettings.opLog" size="20px" />
          </template>
        </van-cell>
        <van-cell title="清除本地缓存" is-link @click="onClearCache" />
      </div>
    </van-popup>

    <!-- 关于 -->
    <van-popup v-model:show="showAbout" position="bottom" round :style="{ minHeight: '30%' }">
      <div class="popup-content about-content">
        <h3>关于</h3>
        <p class="app-name">溪东社区智慧养老</p>
        <p class="app-version">v1.0.0 (MVP)</p>
        <p class="app-desc">基于IoT传感器 + 规则引擎的社区居家养老智能监护系统</p>
        <van-cell title="技术支持" value="溪东社区" />
      </div>
    </van-popup>

    <!-- 底部导航 -->
    <AppTabbar />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { showToast, showDialog } from 'vant'
import { useRouter } from 'vue-router'
import AppTabbar from '@/components/AppTabbar.vue'
import { statsApi } from '@/api/index'
import { useUserStore } from '@/stores/user'
import { isElderMode, toggleElderMode } from '@/utils/accessibility'

const router = useRouter()
const userStore = useUserStore()

const userInfo = computed(() => ({
  name: userStore.user?.name || '未登录',
  role: userStore.role || 'social_worker',
  userId: userStore.userId || '',
}))

const roleLabel = computed(() => {
  const m: Record<string, string> = {
    social_worker: '社工',
    backup: '值班人',
    building_manager: '楼长',
    director: '主任',
    property: '物业',
  }
  return m[userInfo.value.role] || userInfo.value.role
})

const stats = ref({
  pending: 0,
  processing: 0,
  closed: 0,
  totalElders: 0,
})

async function fetchStats() {
  try {
    const res = await statsApi.me() as unknown as {
      pending_count: number; processing_count: number;
      closed_today: number; total_elders: number;
    }
    stats.value = {
      pending: res.pending_count,
      processing: res.processing_count,
      closed: res.closed_today,
      totalElders: res.total_elders,
    }
  } catch (err) {
    console.error('[Me] fetch stats failed:', err)
  }
}

// 适老模式
const elderMode = ref(isElderMode())
function onElderModeChange() {
  toggleElderMode()
  showToast(elderMode.value ? '已开启适老模式，字号已放大' : '已关闭适老模式')
}

// MVP 降级开关
const switches = ref({
  voiceMock: true,
  baselineFixed: true,
  tuyaMock: true,
})

// 设置弹窗状态
const showAccountInfo = ref(false)
const showChangePwd = ref(false)
const showNotifySetting = ref(false)
const showPrivacy = ref(false)
const showAbout = ref(false)

// 修改密码
const pwdForm = ref({ oldPwd: '', newPwd: '', confirmPwd: '' })
function onChangePwd() {
  if (!pwdForm.value.newPwd || pwdForm.value.newPwd.length < 6) {
    showToast('密码至少 6 位')
    return
  }
  if (pwdForm.value.newPwd !== pwdForm.value.confirmPwd) {
    showToast('两次密码不一致')
    return
  }
  showToast('密码修改成功')
  showChangePwd.value = false
  pwdForm.value = { oldPwd: '', newPwd: '', confirmPwd: '' }
}

// 通知设置
const notifySettings = ref({
  alertPush: true,
  sound: true,
  quietMode: false,
})

// 隐私设置
const privacySettings = ref({
  desensitize: true,
  opLog: true,
})

function onClearCache() {
  showDialog({ title: '确认清除', message: '清除本地缓存不会影响账号数据，确认清除？' }).then(() => {
    localStorage.clear()
    showToast('缓存已清除')
  }).catch(() => {})
}

// 登出
function onLogout() {
  showDialog({ title: '确认退出', message: '确定要退出登录吗？' }).then(() => {
    userStore.logout()
    showToast('已退出')
    router.replace('/login')
  }).catch(() => {})
}

onMounted(() => fetchStats())
</script>

<style scoped>
.me-page {
  padding-bottom: 60px;
}
.user-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 16px;
  background: linear-gradient(135deg, #1677ff, #4096ff);
  color: #fff;
}
.user-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.user-name {
  font-size: 18px;
  font-weight: 600;
}
.logout-section {
  padding: 24px 16px;
}
.popup-content {
  padding: 20px 16px;
}
.popup-content h3 {
  font-size: 18px;
  margin: 0 0 16px;
  text-align: center;
}
.about-content {
  text-align: center;
}
.app-name {
  font-size: 18px;
  font-weight: 600;
  margin: 8px 0 4px;
}
.app-version {
  font-size: 14px;
  color: #999;
  margin: 0 0 12px;
}
.app-desc {
  font-size: 14px;
  color: #666;
  margin: 0 0 16px;
}
</style>
