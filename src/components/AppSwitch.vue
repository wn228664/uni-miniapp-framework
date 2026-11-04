<script setup>
import { computed } from 'vue'
/**
 * 受控开关：modelValue 由父级写回，label 为必需的可访问名称。
 * 通过 update:modelValue 提议新值；loading/disabled 阻止更新，不在组件内持久化。
 */
// props：只读布尔 modelValue、必填可访问 label 与禁用/加载配置。
const props = defineProps({
  /** 属性 modelValue：父级控制的布尔值，默认 false，只通过事件提议更新。 */
  modelValue: Boolean,
  /** 属性 label：必填可访问名称；视觉轨道交给辅助容器统一读屏。 */
  label: { type: String, required: true },
  /** 属性 disabled：父级禁用状态，默认 false，禁止所有更新入口。 */
  disabled: Boolean,
  /** 属性 loading：父级异步等待状态，默认 false；本组件不持有请求锁。 */
  loading: Boolean,
})
// emit：组件事件发布器；只通知父级，由父级决定是否更新受控值或执行业务。
const emit = defineEmits(['update:modelValue'])
// unavailable：disabled/loading 的纯派生开关；为 true 时不接收更新。
const unavailable = computed(
  /**
   * 纯派生是否禁止交互。
   */
  () => props.disabled || props.loading,
)
/**
 * 仅可用时发 update:modelValue；持久化由父级负责。
 * value：拟向父级提议的布尔值；组件不自存第二份选中状态。
 */
function update(value) {
  if (!unavailable.value) emit('update:modelValue', value)
}
/**
 * 键盘或外围触控取反当前受控值，走同一更新入口。
 */
function toggle() {
  update(!props.modelValue)
}
</script>
<template>
  <view
    class="switch-hit"
    role="switch"
    :aria-label="label"
    :aria-checked="modelValue"
    :aria-disabled="unavailable"
    :aria-busy="loading"
    :tabindex="unavailable ? -1 : 0"
    @tap.self="toggle"
    @keydown.enter.prevent="toggle"
    @keydown.space.prevent="toggle"
  >
    <up-switch
      aria-hidden="true"
      :model-value="modelValue"
      :disabled="unavailable"
      :loading="loading"
      @change="update"
      @tap.stop
    />
  </view>
</template>
<style scoped>
/* 留出比视觉轨道更大的触控区；轨道点击与外围点击各自只发出一次更新。 */
.switch-hit {
  min-height: 46px;
  min-width: 62px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
