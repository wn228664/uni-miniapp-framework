<script setup>
import { computed, ref } from 'vue'
import { dateInput, dateTimestamp } from '../utils/index.js'
import AppControl from './AppControl.vue'
/**
 * 标量字段视图：通过 update:modelValue 写回，不直接修改父对象；Enter 发出 confirm。
 * select 的 options 为 value/text；date 对外为本地 YYYY-MM-DD，对内才使用时间戳。
 * 暴露 close() 关闭选择层，规则和提交责任由 AppForm 持有。
 */
const props = defineProps({
  field: { type: Object, required: true },
  modelValue: { type: [String, Number, Boolean], default: '' },
  disabled: Boolean,
  error: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue', 'confirm'])
const opened = ref(false)
const options = computed(() => props.field.options || [])
const selected = computed(() => options.value.find((option) => option.value === props.modelValue))
const indices = computed(() => [
  Math.max(
    0,
    options.value.findIndex((option) => option.value === props.modelValue),
  ),
])
const pickerDate = computed(() => dateTimestamp(props.modelValue) ?? Date.now())
function close() {
  opened.value = false
}
defineExpose({ close })
function update(value) {
  emit('update:modelValue', value)
}
function select(event) {
  const choice = event.value[0]
  if (choice) update(choice.value)
  opened.value = false
}
function selectDate(event) {
  update(dateInput(event.value))
  opened.value = false
}
</script>
<template>
  <view class="field" :id="`field-${field.name}`">
    <view class="field-label">{{ field.label }}</view>
    <view v-if="field.type === 'select'">
      <AppControl
        :label="selected?.text || field.placeholder || '请选择'"
        secondary
        :disabled="disabled || !options.length"
        @activate="opened = true"
      />
      <up-picker
        v-if="opened"
        :show="opened"
        :columns="[options]"
        key-name="text"
        :title="field.label"
        :default-index="indices"
        :duration="0"
        @confirm="select"
        @cancel="opened = false"
        @close="opened = false"
      />
    </view>
    <view v-else-if="field.type === 'date'">
      <AppControl
        :label="String(modelValue || field.placeholder || '选择日期')"
        secondary
        :disabled="disabled"
        @activate="opened = true"
      />
      <up-datetime-picker
        v-if="opened"
        :show="opened"
        :model-value="pickerDate"
        mode="date"
        :title="field.label"
        :min-date="field.minDate"
        :max-date="field.maxDate"
        @confirm="selectDate"
        @cancel="opened = false"
        @close="opened = false"
      />
    </view>
    <up-input
      v-else
      :model-value="modelValue"
      :placeholder="field.placeholder || `请输入${field.label}`"
      :disabled="disabled"
      :maxlength="field.maxLength ?? 200"
      :type="field.type || 'text'"
      :clearable="false"
      :aria-label="field.label"
      :aria-invalid="Boolean(error)"
      :aria-describedby="error ? `error-${field.name}` : undefined"
      @update:model-value="update"
      @confirm="$emit('confirm')"
    />
    <view v-if="error" :id="`error-${field.name}`" class="error" role="alert">{{ error }}</view>
  </view>
</template>
