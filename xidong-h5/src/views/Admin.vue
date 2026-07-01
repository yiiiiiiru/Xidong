<template>
  <div class="admin-page">
    <van-nav-bar title="数据管理" left-arrow @click-left="$router.back()" />

    <van-tabs v-model:active="activeTab" sticky>
      <!-- ===== Tab 1: 老人管理 ===== -->
      <van-tab title="老人管理">
        <van-search v-model="elderSearch" placeholder="搜索姓名" @search="fetchElders" />
        <van-pull-refresh v-model="elderRefreshing" @refresh="fetchElders().then(() => elderRefreshing = false)">
          <div class="list-content">
            <van-cell-group inset>
              <van-swipe-cell v-for="e in elders" :key="e.id">
                <van-cell :title="e.name" :label="`${e.building}幢${e.room}室 · ${riskLabel(e.risk_class)}${e.updated_by ? ' · 最后修改: ' + e.updated_by : ''}`" is-link @click="editElder(e)">
                  <template #value>
                    <van-tag :type="riskColor(e.risk_class)" plain>{{ e.risk_class }}</van-tag>
                  </template>
                </van-cell>
                <template #right>
                  <van-button square type="danger" text="删除" @click="deleteElder(e)" />
                </template>
              </van-swipe-cell>
            </van-cell-group>
            <van-empty v-if="!elders.length" description="暂无老人档案" />
          </div>
        </van-pull-refresh>
        <div class="fab-btn">
          <van-button icon="plus" type="primary" round @click="showElderAdd" />
        </div>

        <!-- 老人编辑弹窗 -->
        <van-popup v-model:show="elderFormShow" position="bottom" round :style="{ height: '75%' }">
          <van-nav-bar :title="elderIsEdit ? '编辑老人' : '新增老人'" left-text="取消" right-text="保存" @click-left="elderFormShow = false" @click-right="saveElder" />
          <van-cell-group inset style="margin-top: 12px">
            <van-field v-model="elderForm.name" label="姓名" placeholder="张阿婆" />
            <van-field v-model="elderForm.gender" label="性别" placeholder="男/女" />
            <van-field v-model="elderForm.age" label="年龄" placeholder="82" type="digit" />
            <van-field v-model="elderForm.phone" label="电话" placeholder="138xxxx1001" type="tel" />
            <van-field v-model="elderForm.building" label="楼栋" placeholder="3" />
            <van-field v-model="elderForm.room" label="房间" placeholder="301" />
            <van-field label="风险等级" readonly is-link :model-value="riskLabel(elderForm.risk_class)" @click="showRiskPicker = true" />
            <van-field label="服务等级" readonly is-link :model-value="planLabel(elderForm.plan_level)" @click="showPlanPicker = true" />
            <van-field v-model="elderForm.property_phone" label="物业电话" placeholder="24h值班" type="tel" />
          </van-cell-group>
        </van-popup>

        <van-action-sheet v-model:show="showRiskPicker" :actions="riskActions" @select="(a: any) => { elderForm.risk_class = a.value; showRiskPicker = false }" cancel-text="取消" />
        <van-action-sheet v-model:show="showPlanPicker" :actions="planActions" @select="(a: any) => { elderForm.plan_level = a.value; showPlanPicker = false }" cancel-text="取消" />
      </van-tab>

      <!-- ===== Tab 2: 人员管理 ===== -->
      <van-tab title="人员管理">
        <van-dropdown-menu>
          <van-dropdown-item v-model="filterRole" :options="roleOptions" @change="fetchWorkers" />
        </van-dropdown-menu>
        <van-pull-refresh v-model="workerRefreshing" @refresh="fetchWorkers().then(() => workerRefreshing = false)">
          <div class="list-content">
            <van-cell-group inset>
              <van-swipe-cell v-for="w in workers" :key="w.id">
                <van-cell :title="w.name" :label="roleLabel(w.role) + (w.building ? ` (${w.building}幢)` : '')" is-link @click="editWorker(w)">
                  <template #right-icon>
                    <van-tag v-if="w.on_duty" type="success" plain>当班</van-tag>
                  </template>
                </van-cell>
                <template #right>
                  <van-button square type="danger" text="删除" @click="deleteWorker(w)" />
                </template>
              </van-swipe-cell>
            </van-cell-group>
            <van-empty v-if="!workers.length" description="暂无人员" />
          </div>
        </van-pull-refresh>
        <div class="fab-btn">
          <van-button icon="plus" type="primary" round @click="showWorkerAdd" />
        </div>

        <!-- 人员编辑弹窗 -->
        <van-popup v-model:show="workerFormShow" position="bottom" round :style="{ height: '65%' }">
          <van-nav-bar :title="workerIsEdit ? '编辑人员' : '新增人员'" left-text="取消" right-text="保存" @click-left="workerFormShow = false" @click-right="saveWorker" />
          <van-cell-group inset style="margin-top: 12px">
            <van-field v-model="workerForm.name" label="姓名" placeholder="张社工" />
            <van-field v-model="workerForm.phone" label="电话" placeholder="138xxxx0001" type="tel" />
            <van-field label="角色" readonly is-link :model-value="roleLabel(workerForm.role)" @click="showWorkerRolePicker = true" />
            <van-field v-if="workerForm.role === 'building_manager'" v-model="workerForm.building" label="负责楼栋" placeholder="3" />
            <van-field label="当班">
              <template #input>
                <van-switch v-model="workerForm.on_duty" />
              </template>
            </van-field>
          </van-cell-group>
        </van-popup>

        <van-action-sheet v-model:show="showWorkerRolePicker" :actions="workerRoleActions" @select="(a: any) => { workerForm.role = a.value; showWorkerRolePicker = false }" cancel-text="取消" />
      </van-tab>
    </van-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { showToast, showConfirmDialog } from 'vant'
import { elderApi, elderApiExt, workerApi, type Elder, type Worker } from '@/api/index'
import { RISK_ACTIONS, PLAN_ACTIONS, RISK_LABELS, RISK_COLORS, ROLE_OPTIONS, WORKER_ROLE_ACTIONS } from '@/utils/constants'
import { getPlanLabel, getWorkerRoleLabel } from '@/composables/useAlertMaps'

const activeTab = ref(0)

// ─── 老人管理 ───
const elderSearch = ref('')
const elderRefreshing = ref(false)
const elders = ref<Elder[]>([])
const elderFormShow = ref(false)
const elderIsEdit = ref(false)
const showRiskPicker = ref(false)
const showPlanPicker = ref(false)

const elderForm = ref({
  id: '',
  name: '',
  gender: '女',
  age: '',
  phone: '',
  building: '',
  room: '',
  risk_class: 'C',
  plan_level: 'basic',
  property_phone: '',
})

const riskActions = RISK_ACTIONS
const planActions = PLAN_ACTIONS

function riskLabel(r: string) {
  return RISK_LABELS[r] || r
}
function riskColor(r: string) {
  return RISK_COLORS[r] || 'default'
}
function planLabel(p: string) {
  return getPlanLabel(p)
}

async function fetchElders() {
  try {
    const params: Record<string, unknown> = {}
    if (elderSearch.value) params.name = elderSearch.value
    const res = await elderApi.list(params)
    elders.value = res.items || []
  } catch (err) {
    console.error('[Admin] fetch elders:', err)
  }
}

function showElderAdd() {
  elderIsEdit.value = false
  elderForm.value = { id: '', name: '', gender: '女', age: '', phone: '', building: '', room: '', risk_class: 'C', plan_level: 'basic', property_phone: '' }
  elderFormShow.value = true
}

function editElder(e: Elder) {
  elderIsEdit.value = true
  elderForm.value = {
    id: e.id,
    name: e.name,
    gender: e.gender || '女',
    age: String(e.age || ''),
    phone: (e as any).phone || '',
    building: e.building,
    room: e.room,
    risk_class: e.risk_class,
    plan_level: e.plan_level,
    property_phone: (e as any).property_phone || '',
  }
  elderFormShow.value = true
}

async function saveElder() {
  if (!elderForm.value.name) { showToast('请输入姓名'); return }
  if (!elderForm.value.building) { showToast('请输入楼栋'); return }
  try {
    const data: Record<string, unknown> = {
      name: elderForm.value.name,
      gender: elderForm.value.gender,
      age: Number(elderForm.value.age) || undefined,
      phone: elderForm.value.phone || undefined,
      building: elderForm.value.building,
      room: elderForm.value.room || undefined,
      risk_class: elderForm.value.risk_class,
      plan_level: elderForm.value.plan_level,
      property_phone: elderForm.value.property_phone || undefined,
    }
    if (elderIsEdit.value) {
      await elderApiExt.update(elderForm.value.id, data)
      showToast('更新成功')
    } else {
      await elderApiExt.create(data)
      showToast('创建成功')
    }
    elderFormShow.value = false
    await fetchElders()
  } catch {
    showToast('操作失败')
  }
}

async function deleteElder(e: Elder) {
  try {
    await showConfirmDialog({ title: '确认删除', message: `确定删除 ${e.name}？删除后不可恢复` })
    await elderApiExt.delete(e.id)
    showToast('已删除')
    await fetchElders()
  } catch { /* 取消 */ }
}

// ─── 人员管理 ───
const filterRole = ref('')
const workerRefreshing = ref(false)
const workers = ref<Worker[]>([])
const workerFormShow = ref(false)
const workerIsEdit = ref(false)
const showWorkerRolePicker = ref(false)

const workerForm = ref({
  id: '',
  name: '',
  phone: '',
  role: 'social_worker',
  building: '',
  on_duty: false,
})

const roleOptions = ROLE_OPTIONS
const workerRoleActions = WORKER_ROLE_ACTIONS

function roleLabel(role: string) {
  return getWorkerRoleLabel(role)
}

async function fetchWorkers() {
  try {
    const params: Record<string, unknown> = {}
    if (filterRole.value) params.role = filterRole.value
    const res = await workerApi.list(params)
    workers.value = res.items || []
  } catch (err) {
    console.error('[Admin] fetch workers:', err)
  }
}

function showWorkerAdd() {
  workerIsEdit.value = false
  workerForm.value = { id: '', name: '', phone: '', role: 'social_worker', building: '', on_duty: false }
  workerFormShow.value = true
}

function editWorker(w: Worker) {
  workerIsEdit.value = true
  workerForm.value = { id: w.id, name: w.name, phone: w.phone, role: w.role, building: w.building || '', on_duty: w.on_duty }
  workerFormShow.value = true
}

async function saveWorker() {
  if (!workerForm.value.name) { showToast('请输入姓名'); return }
  try {
    const data = {
      name: workerForm.value.name,
      phone: workerForm.value.phone,
      role: workerForm.value.role,
      building: workerForm.value.building || undefined,
      on_duty: workerForm.value.on_duty,
    }
    if (workerIsEdit.value) {
      await workerApi.update(workerForm.value.id, data)
      showToast('更新成功')
    } else {
      await workerApi.create(data as any)
      showToast('创建成功')
    }
    workerFormShow.value = false
    await fetchWorkers()
  } catch {
    showToast('操作失败')
  }
}

async function deleteWorker(w: Worker) {
  try {
    await showConfirmDialog({ title: '确认删除', message: `确定删除 ${w.name}？` })
    await workerApi.delete(w.id)
    showToast('已删除')
    await fetchWorkers()
  } catch { /* 取消 */ }
}

onMounted(() => {
  fetchElders()
  fetchWorkers()
})
</script>

<style scoped>
.list-content { min-height: 50vh; padding: 12px; }
.fab-btn { position: fixed; bottom: 80px; right: 24px; z-index: 100; }
</style>
