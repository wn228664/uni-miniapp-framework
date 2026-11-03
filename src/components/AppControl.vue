<script setup>
import { computed } from 'vue'
/**
 * uView 基础操作入口：label 提供可访问名称，自定义 slot 也应保留 label。
 * activate 只在可用状态发出；loading/disabled 不提供任务锁，异步动作使用 AppButton。
 */
const props = defineProps({
  label: { type: String, default: '' },
  loading: Boolean,
  disabled: Boolean,
  secondary: Boolean,
})
const emit = defineEmits(['activate'])
const unavailable = computed(() => props.loading || props.disabled)
// 统一触控尺寸和换行；异步任务锁由 AppButton/createAction 持有，视觉组件只拦截不可用入口。
const controlStyle = { minHeight: '46px', height: 'auto', padding: '10px 14px', borderRadius: '10px' }
function activate() {
  if (!unavailable.value) emit('activate')
}
</script>
<template>
  <up-button
    role="button"
    :aria-label="label"
    :text="label"
    :aria-disabled="unavailable"
    :aria-busy="loading"
    :tabindex="unavailable ? -1 : 0"
    @keydown.enter.prevent="activate"
    @keydown.space.prevent="activate"
    type="primary"
    :color="secondary ? 'var(--primary)' : '#2864dc'"
    :plain="secondary"
    :custom-style="controlStyle"
    :disabled="unavailable"
    :loading="loading"
    :throttle-time="0"
    @click="activate"
  >
    <slot>
      <text class="control-label">{{ label }}</text>
    </slot>
  </up-button>
</template>

<style scoped>
.control-label {
  display: block;
  flex: 1;
  min-width: 0;
  max-width: 100%;
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
  line-height: 1.5;
  text-align: center;
}
</style>
