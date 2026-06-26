<template>
  <van-popup v-model:show="visible" position="bottom" round :style="{ minHeight: '40vh' }">
    <div class="status-modal">
      <h3 class="modal-title">{{ title }}</h3>

      <van-field
        v-model="form.status"
        is-link
        readonly
        label="状态"
        :placeholder="statusLabel"
        @click="showStatusPicker = true"
      />

      <van-field
        v-model="form.startAt"
        is-link
        readonly
        label="开始日期"
        placeholder="选择开始日期"
        @click="showStartPicker = true"
      />

      <van-field
        v-model="form.endAt"
        is-link
        readonly
        label="结束日期"
        placeholder="选择结束日期（可选）"
        @click="showEndPicker = true"
      />

      <van-field
        v-model="form.note"
        type="textarea"
        label="备注"
        placeholder="可选备注"
        rows="2"
        autosize
      />

      <div class="modal-actions">
        <van-button plain @click="visible = false">取消</van-button>
        <van-button type="primary" :loading="submitting" @click="onSubmit">确认</van-button>
      </div>
    </div>

    <!-- 状态选择 -->
    <van-popup v-model:show="showStatusPicker" position="bottom" round>
      <van-picker
        :columns="statusOptions"
        @confirm="onStatusConfirm"
        @cancel="showStatusPicker = false"
      />
    </van-popup>

    <!-- 日期选择 -->
    <van-popup v-model:show="showStartPicker" position="bottom" round>
      <van-date-picker
        v-model="startDate"
        title="开始日期"
        @confirm="onStartConfirm"
        @cancel="showStartPicker = false"
      />
    </van-popup>

    <van-popup v-model:show="showEndPicker" position="bottom" round>
      <van-date-picker
        v-model="endDate"
        title="结束日期"
        @confirm="onEndConfirm"
        @cancel="showEndPicker = false"
      />
    </van-popup>
  </van-popup>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { showToast } from 'vant'
import { elderApi } from '@/api/index'

const props = defineProps<{
  elderId: string
  elderName?: string
}>()

const visible = defineModel<boolean>('show', { default: false })
const emit = defineEmits<{ (e: 'success'): void }>()

const title = computed(() => `设置状态 - ${props.elderName || ''}`)

const form = ref({
  status: '',
  startAt: '',
  endAt: '',
  note: '',
})

const submitting = ref(false)
const showStatusPicker = ref(false)
const showStartPicker = ref(false)
const showEndPicker = ref(false)

const today = new Date()
const startDate = ref([String(today.getFullYear()), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')])
const endDate = ref([...startDate.value])

const statusOptions = [
  { text: '外出', value: 'away' },
  { text: '住院', value: 'hospital' },
  { text: '暂停监护', value: 'paused' },
]

const statusLabel = computed(() => {
  const m: Record<string, string> = { away: '外出', hospital: '住院', paused: '暂停监护' }
  return m[form.value.status] || '请选择'
})

function onStatusConfirm({ selectedOptions }: { selectedOptions: Array<{ text: string; value: string }> }) {
  form.value.status = selectedOptions[0].value
  showStatusPicker.value = false
}

function onStartConfirm({ selectedValues }: { selectedValues: string[] }) {
  form.value.startAt = selectedValues.join('-')
  showStartPicker.value = false
}

function onEndConfirm({ selectedValues }: { selectedValues: string[] }) {
  form.value.endAt = selectedValues.join('-')
  showEndPicker.value = false
}

async function onSubmit() {
  if (!form.value.status) {
    showToast('请选择状态')
    return
  }
  if (!form.value.startAt) {
    showToast('请选择开始日期')
    return
  }

  submitting.value = true
  try {
    await elderApi.setStatus(props.elderId, {
      status: form.value.status,
      start_at: form.value.startAt,
      end_at: form.value.endAt || undefined,
      note: form.value.note || undefined,
    })
    showToast('设置成功')
    visible.value = false
    emit('success')
  } catch {
    showToast('设置失败')
  } finally {
    submitting.value = false
  }
}

// 打开时重置表单
watch(visible, (v) => {
  if (v) {
    form.value = { status: '', startAt: '', endAt: '', note: '' }
  }
})
</script>

<style scoped>
.status-modal {
  padding: 16px;
}
.modal-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 16px;
  text-align: center;
}
.modal-actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
  padding: 0 16px;
}
.modal-actions .van-button {
  flex: 1;
}
</style>
