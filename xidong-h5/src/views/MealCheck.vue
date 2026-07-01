<template>
  <div class="meal-check">
    <van-nav-bar title="食堂签到" fixed placeholder />

    <!-- 日期选择 -->
    <div class="date-bar p-12">
      <van-button size="small" @click="changeDate(-1)">&lt;</van-button>
      <span class="date-text">{{ displayDate }}</span>
      <van-button size="small" @click="changeDate(1)" :disabled="isToday">&gt;</van-button>
    </div>

    <!-- 统计卡片 -->
    <van-cell-group inset class="stats-card">
      <van-grid :column-num="4" :border="false">
        <van-grid-item>
          <div class="stat-num">{{ stats.breakfast }}</div>
          <div class="stat-label">早餐</div>
        </van-grid-item>
        <van-grid-item>
          <div class="stat-num">{{ stats.lunch }}</div>
          <div class="stat-label">午餐</div>
        </van-grid-item>
        <van-grid-item>
          <div class="stat-num">{{ stats.dinner }}</div>
          <div class="stat-label">晚餐</div>
        </van-grid-item>
        <van-grid-item>
          <div class="stat-num highlight">{{ stats.coverage_rate }}%</div>
          <div class="stat-label">覆盖率</div>
        </van-grid-item>
      </van-grid>
    </van-cell-group>

    <!-- 签到表单 -->
    <van-cell-group inset title="签到录入">
      <van-field
        v-model="form.elderName"
        label="老人"
        placeholder="输入姓名搜索"
        @focus="showElderPicker = true"
        readonly
        is-link
      />
      <van-field label="餐次">
        <template #input>
          <van-radio-group v-model="form.mealType" direction="horizontal">
            <van-radio name="breakfast">早餐</van-radio>
            <van-radio name="lunch">午餐</van-radio>
            <van-radio name="dinner">晚餐</van-radio>
          </van-radio-group>
        </template>
      </van-field>
      <van-field
        v-model="form.amount"
        label="金额"
        type="digit"
        placeholder="消费金额（可选）"
      >
        <template #button>元</template>
      </van-field>
      <van-field v-model="form.note" label="备注" placeholder="可选" />
    </van-cell-group>

    <div class="p-12">
      <van-button type="primary" block round :loading="submitting" @click="submit">
        确认签到
      </van-button>
    </div>

    <!-- 今日签到记录 -->
    <van-cell-group inset title="签到记录">
      <van-empty v-if="records.length === 0" description="暂无记录" />
      <van-cell
        v-for="r in records"
        :key="r.id"
        :title="r.elder_name || r.elder_id"
        :label="mealLabel(r.meal_type) + (r.amount > 0 ? ` ¥${r.amount}` : '')"
        :value="r.checked_at.slice(11, 16)"
      />
    </van-cell-group>

    <!-- 老人选择弹窗 -->
    <van-popup v-model:show="showElderPicker" position="bottom" round :style="{ height: '50%' }">
      <van-search v-model="elderSearch" placeholder="搜索老人姓名" />
      <van-cell
        v-for="e in filteredElders"
        :key="e.id"
        :title="e.name"
        :label="`${e.building}幢${e.room}室`"
        @click="selectElder(e)"
      />
    </van-popup>

    <!-- 底部导航 -->
    <AppTabbar />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { showToast } from 'vant'
import AppTabbar from '@/components/AppTabbar.vue'
import { mealApi, elderApi, type MealRecord } from '@/api/index'
import { MEAL_TIME_THRESHOLDS, MEAL_TYPE_LABELS } from '@/utils/constants'

const showElderPicker = ref(false)
const elderSearch = ref('')
const submitting = ref(false)
const selectedDate = ref(new Date())

const form = ref({
  elderId: '',
  elderName: '',
  mealType: currentMealType(),
  amount: '',
  note: '',
})

const stats = ref({
  breakfast: 0,
  lunch: 0,
  dinner: 0,
  coverage_rate: 0,
})

const records = ref<MealRecord[]>([])
const elders = ref<Array<{ id: string; name: string; building: string; room: string }>>([])

const displayDate = computed(() => {
  const d = selectedDate.value
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
})

const isToday = computed(() => displayDate.value === new Date().toISOString().slice(0, 10))

const filteredElders = computed(() => {
  if (!elderSearch.value) return elders.value
  return elders.value.filter((e) => e.name.includes(elderSearch.value))
})

function currentMealType(): string {
  const h = new Date().getHours()
  if (h < MEAL_TIME_THRESHOLDS.BREAKFAST_END) return 'breakfast'
  if (h < MEAL_TIME_THRESHOLDS.LUNCH_END) return 'lunch'
  return 'dinner'
}

function mealLabel(type: string): string {
  return MEAL_TYPE_LABELS[type] || type
}

function changeDate(delta: number) {
  const d = new Date(selectedDate.value)
  d.setDate(d.getDate() + delta)
  if (d > new Date()) return
  selectedDate.value = d
  fetchData()
}

function selectElder(e: { id: string; name: string }) {
  form.value.elderId = e.id
  form.value.elderName = e.name
  showElderPicker.value = false
}

async function fetchData() {
  const date = displayDate.value
  try {
    const [statsRes, recordsRes] = await Promise.all([
      mealApi.stats({ date }),
      mealApi.list({ date, page_size: 50 }),
    ])
    stats.value = {
      breakfast: statsRes.breakfast || 0,
      lunch: statsRes.lunch || 0,
      dinner: statsRes.dinner || 0,
      coverage_rate: statsRes.coverage_rate || 0,
    }
    records.value = recordsRes.items || []
  } catch (err) {
    console.error('[MealCheck] fetch failed:', err)
    showToast('签到数据加载失败')
  }
}

async function fetchElders() {
  try {
    const res = await elderApi.list({ page_size: 100 }) as { items: Array<{ id: string; name: string; building: string; room: string }> }
    elders.value = res.items || []
  } catch (err) {
    console.error('[MealCheck] fetch elders failed:', err)
    showToast('老人列表加载失败')
  }
}

async function submit() {
  if (!form.value.elderId) {
    showToast('请选择老人')
    return
  }
  submitting.value = true
  try {
    await mealApi.checkin({
      elder_id: form.value.elderId,
      meal_type: form.value.mealType,
      amount: form.value.amount ? Number(form.value.amount) : undefined,
      note: form.value.note || undefined,
    })
    showToast('签到成功')
    form.value = { elderId: '', elderName: '', mealType: currentMealType(), amount: '', note: '' }
    await fetchData()
  } catch (err: unknown) {
    const msg =
      (err as { response?: { data?: { error?: string } } })?.response?.data?.error || '签到失败'
    showToast(msg === 'already_checked' ? '该餐次已签到' : msg)
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  fetchData()
  fetchElders()
})
</script>

<style scoped>
.date-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
}
.date-text {
  font-size: 16px;
  font-weight: 600;
}
.stats-card {
  margin: 8px 12px;
}
.stat-num {
  font-size: 24px;
  font-weight: 700;
  color: var(--van-primary-color);
}
.stat-num.highlight {
  color: #ee0a24;
}
.stat-label {
  font-size: 12px;
  color: #666;
  margin-top: 4px;
}
.p-12 {
  padding: 12px;
}
</style>
