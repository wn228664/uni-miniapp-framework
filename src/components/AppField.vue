<script setup>
import { computed, ref } from 'vue'
import { dateInput, dateTimestamp } from '../utils/index.js'
import AppControl from './AppControl.vue'
/**
 * 标量字段视图：通过 update:modelValue 写回，不直接修改父对象；Enter 发出 confirm。
 * select 的 options 为 value/text；date 对外为本地 YYYY-MM-DD，对内才使用时间戳。
 * 暴露 close() 关闭选择层，规则和提交责任由 AppForm 持有。
 */
// props：父级字段 schema/标量值/disabled/错误文本；只通过事件回填。
const props = defineProps({
  /** 属性 field：必填字段 schema：name 为模型键，label 为名称，type 决定控件；options 为 value/text，日期边界为毫秒，maxLength 默认 200。 */
  field: { type: Object, required: true },
  /** 属性 modelValue：父级标量字段值；只能用 update:modelValue 提议变更，默认空串。 */
  modelValue: { type: [String, Number, Boolean], default: '' },
  /** 属性 disabled：只读交互开关，父级提交时禁止编辑，默认 false。 */
  disabled: Boolean,
  /** 属性 error：此字段公开错误文本，默认空串；非空时关联 aria-describedby。 */
  error: { type: String, default: '' },
})
// emit：组件事件发布器；只通知父级，由父级决定是否更新受控值或执行业务。
const emit = defineEmits(['update:modelValue', 'confirm'])
// opened：选择/日期面板开关，初值 false；close 暴露给表单统一取消。
const opened = ref(false)
// options：当前 field.options，缺失时用空数组，不猜远端选项。
const options = computed(
  /**
   * 纯读取字段的选项列表，缺失时为空。
   */
  () => props.field.options || [],
)
// selected：与 modelValue 严格相等的选项对象；未找到时显示 placeholder。
const selected = computed(
  /**
   * 根据受控值派生当前选项，不写回父级。
   */
  () =>
    options.value.find(
      /**
       * 比较候选 option.value 与受控值。
       * option：字段选项，value 与父级 modelValue 做严格相等比较。
       */
      (option) => option.value === props.modelValue,
    ),
)
// indices：选择器初始单列索引；没有匹配项时从 0 开始。
const indices = computed(
  /**
   * 派生单列选择器的合法初始索引。
   */
  () => [
    Math.max(
      0,
      options.value.findIndex(
        /**
         * 寻找与受控值严格匹配的候选项。
         * option：字段选项，value 与父级 modelValue 做严格相等比较。
         */
        (option) => option.value === props.modelValue,
      ),
    ),
  ],
)
// pickerDate：日期选择器毫秒时间戳；合法本地日历值转正午，无值时取当前时间。
const pickerDate = computed(
  /**
   * 将本地日历值转成选择器时间戳，无值时用当前时钟。
   */
  () => dateTimestamp(props.modelValue) ?? Date.now(),
)
/**
 * 关闭当前字段选择层，不清空原值。
 */
function close() {
  opened.value = false
}
defineExpose({ close })
/**
 * 向父级提议新的标量值。
 * value：拟回填的标量字段值；不在字段层修改父级对象。
 */
function update(value) {
  emit('update:modelValue', value)
}
/**
 * 选择确认时回填首列 value 并关闭面板。
 * event：uView 选择器确认载荷；select 取首列选项，selectDate 取日期毫秒值。
 */
function select(event) {
  // choice：选择器确认事件第一列的选项对象；空选择不更新受控值。
  const choice = event.value[0]
  if (choice) update(choice.value)
  opened.value = false
}
/**
 * 日期确认转成本地 YYYY-MM-DD，再关闭面板。
 * event：uView 选择器确认载荷；select 取首列选项，selectDate 取日期毫秒值。
 */
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
