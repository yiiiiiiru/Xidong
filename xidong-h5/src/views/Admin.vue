<template>
  <div class="admin-page">
    <van-nav-bar title="人员管理" left-arrow @click-left="$router.back()" />

    <!-- 角色筛选 -->
    <van-dropdown-menu>
      <van-dropdown-item v-model="filterRole" :options="roleOptions" @change="fetchWorkers" />
    </van-dropdown-menu>

    <!-- 人员列表 -->
    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <div class="list-content p-12">
        <van-cell-group inset>
          <van-swipe-cell v-for="w in workers" :key="w.id">
            <van-cell
              :title="w.name"
              :label="roleLabel(w.role) + (w.building ? ` (${w.building}幢)` : '')"
              :value="w.on_duty ? '当班' : ''"
              is-link
              @click="editWorker(w)"
            >
              <template #right-icon>
                <van-tag v-if="w.on_duty" type="success" plain>当班</van-tag>
              </template>
            </van-cell>
            <template #right>
              <van-button square type="danger" text="删除" @click="onDelete(w)" />
            </template>
          </van-swipe-cell>
        </van-cell-group>
        <van-empty v-if="!workers.length" description="暂无人员" />
      </div>
    </van-pull-refresh>

    <!-- 新增按钮 -->
    <div class="fab-btn">
      <van-button icon="plus" type="primary" round @click="showAddForm" />
    </div>

    <!-- 编辑/新增弹窗 -->
    <van-popup v-model:show="showForm" position="bottom" round :style="{ height: '70%' }">
      <van-nav-bar
        :title="isEdit ? '编辑人员' : '新增人员'"
        left-text="取消"
        right-text="保存"
        @click-left="showForm = false"
        @click-right="onSave"
      />
      <van-cell-group inset>
        <van-field v-model="form.name" label="姓名" placeholder="请输入姓名" />
        <van-field v-model="form.phone" label="电话" placeholder="请输入电话" type="tel" />
        <van-field label="角色" readonly is-link @click="showRolePicker = true" :model-value="roleLabel(form.role)" />
        <van-field v-if="form.role === 'building_manager'" v-model="form.building" label="负责楼栋" placeholder="如：3" />
        <van-field label="当班">
          <template #input>
            <van-switch v-model="form.on_duty" />
          </template>
        </van-field>
      </van-cell-group>
    </van-popup>

    <!-- 角色选择 -->
    <van-action-sheet
      v-model:show="showRolePicker"
      :actions="roleActions"
      @select="onRoleSelect"
      cancel-text="取消"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { showToast, showConfirmDialog } from 'vant'
import { workerApi, type Worker } from '@/api/index'

const refreshing = ref(false)
const filterRole = ref('')
const showForm = ref(false)
const showRolePicker = ref(false)
const isEdit = ref(false)

const workers = ref<Worker[]>([])

const form = ref({
  id: '',
  name: '',
  phone: '',
  role: 'social_worker',
  building: '',
  on_duty: false,
})

const roleOptions = [
  { text: '全部角色', value: '' },
  { text: '社工', value: 'social_worker' },
  { text: '备班', value: 'backup' },
  { text: '楼长', value: 'building_manager' },
  { text: '主任', value: 'director' },
  { text: '物业', value: 'property' },
]

const roleActions = [
  { name: '社工', value: 'social_worker' },
  { name: '备班', value: 'backup' },
  { name: '楼长', value: 'building_manager' },
  { name: '主任', value: 'director' },
  { name: '物业', value: 'property' },
]

function roleLabel(role: string): string {
  const m: Record<string, string> = {
    social_worker: '社工', backup: '备班',
    building_manager: '楼长', director: '主任', property: '物业',
  }
  return m[role] || role
}

async function fetchWorkers() {
  try {
    const params: Record<string, unknown> = {}
    if (filterRole.value) params.role = filterRole.value
    const res = await workerApi.list(params) as unknown as { items: Worker[] }
    workers.value = res.items || []
  } catch (err) {
    console.error('[Admin] fetch failed:', err)
  }
}

function showAddForm() {
  isEdit.value = false
  form.value = { id: '', name: '', phone: '', role: 'social_worker', building: '', on_duty: false }
  showForm.value = true
}

function editWorker(w: Worker) {
  isEdit.value = true
  form.value = { id: w.id, name: w.name, phone: w.phone, role: w.role, building: w.building || '', on_duty: w.on_duty }
  showForm.value = true
}

function onRoleSelect(action: { value: string }) {
  form.value.role = action.value
  showRolePicker.value = false
}

async function onSave() {
  if (!form.value.name) { showToast('请输入姓名'); return }
  try {
    if (isEdit.value) {
      await workerApi.update(form.value.id, {
        name: form.value.name,
        phone: form.value.phone,
        role: form.value.role,
        building: form.value.building || undefined,
        on_duty: form.value.on_duty,
      })
      showToast('更新成功')
    } else {
      await workerApi.create({
        name: form.value.name,
        phone: form.value.phone,
        role: form.value.role as Worker['role'],
        building: form.value.building || undefined,
        on_duty: form.value.on_duty,
      })
      showToast('创建成功')
    }
    showForm.value = false
    await fetchWorkers()
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || '操作失败'
    showToast(msg)
  }
}

async function onDelete(w: Worker) {
  try {
    await showConfirmDialog({ title: '确认删除', message: `确定删除 ${w.name}？` })
    await workerApi.delete(w.id)
    showToast('已删除')
    await fetchWorkers()
  } catch {
    // 取消
  }
}

async function onRefresh() {
  await fetchWorkers()
  refreshing.value = false
}

onMounted(() => fetchWorkers())
</script>

<style scoped>
.list-content { min-height: 60vh; }
.p-12 { padding: 12px; }
.fab-btn { position: fixed; bottom: 24px; right: 24px; z-index: 100; }
</style>
