<script setup>
/** uView 基础触控入口，label 默认空串但调用方须提供可访问名称；loading/disabled 只控制可用体验，不拥有异步动作。键盘 Enter/Space 和点击共用 activate，父级异步必须使用动作锁。 */

import { computed } from 'vue'
/**
 * uView 基础操作入口：label 提供可访问名称，自定义 slot 也应保留 label。
 * activate 只在可用状态发出；loading/disabled 不提供任务锁，异步动作使用 AppButton。
 */
// props：只读 label/loading/disabled/secondary；不在基础控件里创建请求。
const props = defineProps({
  /** 属性 label：按钮文字及可访问名称；自定义插槽也应传入，默认空串。 */
  label: { type: String, default: '' },
  /** 属性 loading：展示等待状态并阻止鼠标、键盘入口，默认 false。 */
  loading: Boolean,
  /** 属性 disabled：阻止操作与键盘聚焦，默认 false。 */
  disabled: Boolean,
  /** 属性 secondary：使用次级外观，默认 false。 */
  secondary: Boolean,
})
// emit：组件事件发布器；只通知父级，由父级决定是否更新受控值或执行业务。
const emit = defineEmits(['activate'])
// unavailable：loading 或 disabled 的纯派生值；同时控制键盘焦点与点击入口。
const unavailable = computed(
  /**
   * 纯派生是否可交互，避免复制禁用状态。
   */
  () => props.loading || props.disabled,
)
// 统一触控尺寸和换行；异步任务锁由 AppButton/createAction 持有，视觉组件只拦截不可用入口。
// controlStyle：基础触控样式：最小 46px、内容自然增高；只表达尺寸，不定位页面。
const controlStyle = { minHeight: '46px', height: 'auto', padding: '10px 14px', borderRadius: '10px' }
/**
 * 仅在可用时发 activate；不把视觉禁用当幂等保证。
 */
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
