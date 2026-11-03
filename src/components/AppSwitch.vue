<script setup>
import { computed } from 'vue'
/**
 * 受控开关：modelValue 由父级写回，label 为必需的可访问名称。
 * 通过 update:modelValue 提议新值；loading/disabled 阻止更新，不在组件内持久化。
 */
const props = defineProps({
  modelValue: Boolean,
  label: { type: String, required: true },
  disabled: Boolean,
  loading: Boolean,
})
const emit = defineEmits(['update:modelValue'])
const unavailable = computed(() => props.disabled || props.loading)
function update(value) {
  if (!unavailable.value) emit('update:modelValue', value)
}
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
