<template>
  <div class="elder-detail">
    <van-nav-bar title="档案详情" left-arrow @click-left="router.back()" fixed placeholder>
      <template #right>
        <van-icon name="edit" size="18" @click="openEdit" />
      </template>
    </van-nav-bar>

    <div class="detail-content p-12">
      <!-- 基本信息卡 -->
      <van-cell-group inset title="基本信息">
        <van-cell title="姓名" :value="elder.name" />
        <van-cell title="性别" :value="elder.gender === 'F' ? '女' : '男'" />
        <van-cell title="年龄" :value="`${elder.age}岁`" />
        <van-cell title="住址" :value="`${elder.building}幢${elder.room}室`" />
        <van-cell title="电话" :value="elder.phone" />
        <van-cell title="护理等级">
          <template #value>
            <van-tag :type="planTagType">{{ planLabel }}</van-tag>
          </template>
        </van-cell>
        <van-cell title="风险等级">
          <template #value>
            <van-tag :type="riskTagType">{{ elder.risk_class }}级</van-tag>
          </template>
        </van-cell>
        <van-cell title="当前状态">
          <template #value>
            <van-tag :type="statusTagType" plain>{{ statusLabel }}</van-tag>
          </template>
        </van-cell>
        <van-cell title="长期居家" :value="elder.is_homebound ? '是' : '否'" />
      </van-cell-group>

      <!-- 紧急联系人 -->
      <van-cell-group inset title="紧急联系人" class="mt-8">
        <van-cell
          v-for="(c, i) in contacts"
          :key="i"
          :title="`${c.name}（${c.relation}）`"
          :value="c.phone"
          is-link
          @click="callPhone(c.phone)"
        >
          <template #right-icon>
            <van-icon name="phone-o" />
          </template>
        </van-cell>
        <van-empty v-if="!contacts.length" description="暂无紧急联系人" image="search" />
      </van-cell-group>

      <!-- 设备列表 -->
      <van-cell-group inset title="关联设备" class="mt-8">
        <van-cell
          v-for="(d, i) in devices"
          :key="i"
          :title="d.name"
          :label="d.location"
        >
          <template #value>
            <van-tag :type="d.online ? 'success' : 'default'">
              {{ d.online ? '在线' : '离线' }}
            </van-tag>
          </template>
        </van-cell>
      </van-cell-group>

      <!-- 操作按钮 -->
      <div class="action-row mt-8">
        <van-button plain type="primary" size="small" @click="showStatusModal = true">
          设置外出/住院
        </van-button>
        <van-button plain type="warning" size="small" @click="openEdit" class="ml-8">
          编辑信息
        </van-button>
      </div>
    </div>

    <!-- 状态管理弹窗 -->
    <van-action-sheet
      v-model:show="showStatusModal"
      title="设置老人状态"
      :actions="statusActions"
      @select="onStatusSelect"
      cancel-text="取消"
    />

    <!-- 编辑表单弹窗 -->
    <van-popup v-model:show="showEdit" position="bottom" round :style="{ maxHeight: '85%' }">
      <div class="edit-form">
        <van-nav-bar title="编辑档案" left-text="取消" right-text="保存"
          @click-left="showEdit = false" @click-right="submitEdit" />

        <van-form ref="formRef">
          <van-cell-group inset>
            <van-field v-model="editForm.name" label="姓名" placeholder="请输入姓名" :rules="[{ required: true }]" />
            <van-field label="性别" readonly>
              <template #input>
                <van-radio-group v-model="editForm.gender" direction="horizontal">
                  <van-radio name="M">男</van-radio>
                  <van-radio name="F">女</van-radio>
                </van-radio-group>
              </template>
            </van-field>
            <van-field v-model="editForm.age" label="年龄" type="digit" placeholder="请输入年龄" />
            <van-field v-model="editForm.phone" label="电话" type="tel" placeholder="请输入手机号" />
            <van-field v-model="editForm.building" label="楼栋" placeholder="如: 3" />
            <van-field v-model="editForm.room" label="房间" placeholder="如: 301" />
          </van-cell-group>

          <van-cell-group inset title="护理与风险" class="mt-8">
            <van-field label="护理等级" readonly is-link @click="showPlanPicker = true"
              :model-value="planPickerLabel" />
            <van-field label="风险等级" readonly is-link @click="showRiskPicker = true"
              :model-value="riskPickerLabel" />
            <van-field label="长期居家" readonly>
              <template #input>
                <van-switch v-model="editForm.is_homebound" size="20px" />
              </template>
            </van-field>
          </van-cell-group>

          <van-cell-group inset title="紧急联系人" class="mt-8">
            <van-field v-model="editForm.emergency_contact" label="姓名" placeholder="紧急联系人姓名" />
            <van-field v-model="editForm.emergency_phone" label="电话" type="tel" placeholder="紧急联系人电话" />
          </van-cell-group>

          <van-cell-group inset title="其他" class="mt-8">
            <van-field v-model="editForm.property_phone" label="物业电话" type="tel" placeholder="物业值班电话" />
          </van-cell-group>
        </van-form>
      </div>
    </van-popup>

    <!-- 护理等级选择器 -->
    <van-popup v-model:show="showPlanPicker" position="bottom" round>
      <van-picker :columns="planColumns" @confirm="onPlanConfirm" @cancel="showPlanPicker = false" />
    </van-popup>

    <!-- 风险等级选择器 -->
    <van-popup v-model:show="showRiskPicker" position="bottom" round>
      <van-picker :columns="riskColumns" @confirm="onRiskConfirm" @cancel="showRiskPicker = false" />
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast, showSuccessToast } from 'vant'
import { elderApi, elderApiExt } from '@/api/index'

const route = useRoute()
const router = useRouter()
const elderId = route.params.id as string
const showStatusModal = ref(false)
const showEdit = ref(false)
const showPlanPicker = ref(false)
const showRiskPicker = ref(false)

interface ElderDetail {
  id: string; name: string; gender: string; age: number;
  building: string; room: string; plan_level: string;
  risk_class: string; status: string; is_homebound: boolean;
  phone: string; emergency_contact: string; emergency_phone: string;
  property_phone: string;
  devices?: Array<{ devId: string; deviceType: string; location: string }>;
  emergency_contacts?: Array<{ name: string; phone: string; relation: string }>;
}

const elder = ref<ElderDetail>({
  id: elderId, name: '', gender: 'M', age: 0,
  building: '', room: '', plan_level: 'basic',
  risk_class: 'C', status: 'home', is_homebound: false,
  phone: '', emergency_contact: '', emergency_phone: '',
  property_phone: '',
})

// ─── 编辑表单 ───

interface EditForm {
  name: string; gender: string; age: string;
  phone: string; building: string; room: string;
  plan_level: string; risk_class: string; is_homebound: boolean;
  emergency_contact: string; emergency_phone: string;
  property_phone: string;
}

const editForm = ref<EditForm>({
  name: '', gender: 'M', age: '',
  phone: '', building: '', room: '',
  plan_level: 'basic', risk_class: 'C', is_homebound: false,
  emergency_contact: '', emergency_phone: '', property_phone: '',
})

function openEdit() {
  editForm.value = {
    name: elder.value.name,
    gender: elder.value.gender,
    age: String(elder.value.age || ''),
    phone: elder.value.phone,
    building: elder.value.building,
    room: elder.value.room,
    plan_level: elder.value.plan_level,
    risk_class: elder.value.risk_class,
    is_homebound: elder.value.is_homebound,
    emergency_contact: elder.value.emergency_contact,
    emergency_phone: elder.value.emergency_phone,
    property_phone: elder.value.property_phone || '',
  }
  showEdit.value = true
}

async function submitEdit() {
  const data: Record<string, unknown> = {}
  if (editForm.value.name && editForm.value.name !== elder.value.name) data.name = editForm.value.name
  if (editForm.value.gender !== elder.value.gender) data.gender = editForm.value.gender
  if (editForm.value.age && Number(editForm.value.age) !== elder.value.age) data.age = Number(editForm.value.age)
  if (editForm.value.phone && editForm.value.phone !== elder.value.phone) data.phone = editForm.value.phone
  if (editForm.value.building && editForm.value.building !== elder.value.building) data.building = editForm.value.building
  if (editForm.value.room && editForm.value.room !== elder.value.room) data.room = editForm.value.room
  if (editForm.value.plan_level !== elder.value.plan_level) data.plan_level = editForm.value.plan_level
  if (editForm.value.risk_class !== elder.value.risk_class) data.risk_class = editForm.value.risk_class
  if (editForm.value.is_homebound !== elder.value.is_homebound) data.is_homebound = editForm.value.is_homebound
  if (editForm.value.emergency_contact !== elder.value.emergency_contact) data.emergency_contact = editForm.value.emergency_contact
  if (editForm.value.emergency_phone !== elder.value.emergency_phone) data.emergency_phone = editForm.value.emergency_phone
  if (editForm.value.property_phone !== elder.value.property_phone) data.property_phone = editForm.value.property_phone

  if (Object.keys(data).length === 0) {
    showToast('没有修改')
    return
  }

  try {
    await elderApiExt.update(elderId, data)
    showSuccessToast('保存成功')
    showEdit.value = false
    await fetchDetail()
  } catch (err: unknown) {
    const errMsg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || '保存失败'
    showToast(errMsg)
  }
}

// ─── Picker 配置 ───

const planColumns = [
  { text: '全护理', value: 'full' },
  { text: '标准', value: 'standard' },
  { text: '基础', value: 'basic' },
]

const riskColumns = [
  { text: 'A级（高风险）', value: 'A' },
  { text: 'B级（中风险）', value: 'B' },
  { text: 'C级（低风险）', value: 'C' },
]

const planPickerLabel = computed(() => {
  const m: Record<string, string> = { full: '全护理', standard: '标准', basic: '基础' }
  return m[editForm.value.plan_level] || editForm.value.plan_level
})

const riskPickerLabel = computed(() => {
  const m: Record<string, string> = { A: 'A级（高风险）', B: 'B级（中风险）', C: 'C级（低风险）' }
  return m[editForm.value.risk_class] || editForm.value.risk_class
})

function onPlanConfirm({ selectedValues }: { selectedValues: string[] }) {
  editForm.value.plan_level = selectedValues[0]
  showPlanPicker.value = false
}

function onRiskConfirm({ selectedValues }: { selectedValues: string[] }) {
  editForm.value.risk_class = selectedValues[0]
  showRiskPicker.value = false
}

// ─── 详情逻辑 ───

const contacts = computed(() => {
  // 优先用 emergency_contacts 数组
  if (elder.value.emergency_contacts?.length) {
    return elder.value.emergency_contacts.map(c => ({
      name: c.name, relation: c.relation || '紧急联系人', phone: c.phone,
    }))
  }
  if (!elder.value.emergency_contact) return []
  return [{ name: elder.value.emergency_contact, relation: '紧急联系人', phone: elder.value.emergency_phone }]
})

const devices = computed(() =>
  (elder.value.devices || []).map(d => ({
    name: deviceLabel(d.deviceType),
    location: d.location,
    online: true,
  }))
)

function deviceLabel(type: string): string {
  const m: Record<string, string> = { door: '入户门磁', bed: '床垫压感', pir: '人体传感器', button: '床头按钮' }
  return m[type] || type
}

async function fetchDetail() {
  try {
    const res = await elderApi.detail(elderId) as unknown as ElderDetail
    elder.value = res
  } catch (err) {
    console.error('[ElderDetail] fetch failed:', err)
  }
}

// ─── 计算属性 ───

const planTagType = computed(() => {
  const m: Record<string, 'danger' | 'warning' | 'primary'> = {
    full: 'danger', standard: 'warning', basic: 'primary',
  }
  return m[elder.value.plan_level] || 'primary'
})

const planLabel = computed(() => {
  const m: Record<string, string> = { full: '全护理', standard: '标准', basic: '基础' }
  return m[elder.value.plan_level] || elder.value.plan_level
})

const riskTagType = computed(() => {
  const m: Record<string, 'danger' | 'warning' | 'success'> = {
    A: 'danger', B: 'warning', C: 'success',
  }
  return m[elder.value.risk_class] || 'success'
})

const statusLabel = computed(() => {
  const m: Record<string, string> = {
    home: '正常在住', away: '外出', hospital: '住院', paused: '暂停监护',
  }
  return m[elder.value.status] || elder.value.status
})

const statusTagType = computed(() => {
  const m: Record<string, 'success' | 'warning' | 'primary'> = {
    home: 'success', away: 'warning', hospital: 'primary',
  }
  return m[elder.value.status] || 'primary'
})

const statusActions = [
  { name: '正常在住', value: 'home' },
  { name: '外出', value: 'away' },
  { name: '住院', value: 'hospital' },
]

async function onStatusSelect(action: { name: string; value: string }) {
  showStatusModal.value = false
  try {
    const now = new Date().toISOString().slice(0, 10)
    const endAt = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
    await elderApi.setStatus(elderId, { status: action.value, start_at: now, end_at: endAt })
    showToast(`已设置状态: ${action.name}`)
    await fetchDetail()
  } catch {
    showToast('操作失败')
  }
}

function callPhone(phone: string) {
  showToast(`拨打 ${phone}（TODO: 钉钉双呼）`)
}

onMounted(() => fetchDetail())
</script>

<style scoped>
.detail-content {
  padding-bottom: 20px;
}
.action-row {
  padding: 0 16px;
  display: flex;
  gap: 8px;
}
.edit-form {
  max-height: 85vh;
  overflow-y: auto;
  padding-bottom: env(safe-area-inset-bottom);
}
.mt-8 {
  margin-top: 8px;
}
.ml-8 {
  margin-left: 8px;
}
</style>
