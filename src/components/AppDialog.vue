<script setup>
import { nextTick, onScopeDispose, reactive, ref, watch } from 'vue'
import { createAction } from '../core/action.js'
import { isCancelled } from '../core/errors.js'
import AppControl from './AppControl.vue'
/**
 * modelValue 控制可见性，confirm(token) 必填；成功发 confirmed 并关闭，失败留窗。
 * 关闭会卸载局部内容，需保留的表单放在父组件；父页隐藏时应将 modelValue 置 false。
 * H5 焦点与正文滚动在此维护，微信平台行为须单独验收。
 */
const props = defineProps({
  modelValue: Boolean,
  title: { type: String, default: '提示' },
  confirm: { type: Function, required: true },
})
const emit = defineEmits(['update:modelValue', 'confirmed'])
const panel = ref(null)
const state = reactive({ pending: false, error: '' }),
  task = createAction(state)
// 每次打开均拥有独立任务周期；外部关闭与取消按钮都使旧结果失效。
watch(
  () => props.modelValue,
  () => {
    task.cancel()
    state.error = ''
  },
  { flush: 'sync' },
)
function close() {
  task.cancel()
  emit('update:modelValue', false)
}
async function accept() {
  if (state.pending) return
  try {
    await task.run(props.confirm)
    if (props.modelValue) {
      emit('confirmed')
      close()
    }
  } catch (error) {
    if (!isCancelled(error)) state.error = error.message
  }
}
onScopeDispose(task.dispose)
// #ifdef H5
// Web 弹层隔离键盘焦点；小程序不访问 DOM，使用平台的读屏与输入行为。
let focusRevision = 0
let releaseFocus = () => {}
function clearFocus() {
  focusRevision++
  releaseFocus()
  releaseFocus = () => {}
}
watch(
  () => props.modelValue,
  async (open) => {
    clearFocus()
    if (!open) return
    const mine = focusRevision
    const previous = document.activeElement
    await nextTick()
    if (mine !== focusRevision || !props.modelValue) return
    const element = panel.value?.$el || panel.value
    if (!element) return
    const candidates = () =>
      [...element.querySelectorAll('button,input,textarea,select,[tabindex]')].filter(
        (node) =>
          !node.disabled &&
          node.tabIndex >= 0 &&
          node.getClientRects().length &&
          node.getAttribute('aria-disabled') !== 'true',
      )
    function keydown(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
        return
      }
      if (event.key !== 'Tab') return
      const nodes = candidates(),
        first = nodes[0] || element,
        last = nodes[nodes.length - 1] || element
      if (
        !element.contains(document.activeElement) ||
        (event.shiftKey && document.activeElement === first) ||
        (!event.shiftKey && document.activeElement === last)
      ) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
      }
    }
    document.addEventListener('keydown', keydown, true)
    releaseFocus = () => {
      document.removeEventListener('keydown', keydown, true)
      if (previous?.isConnected) previous.focus()
    }
    ;(candidates()[0] || element).focus()
  },
  { flush: 'post', immediate: true },
)
onScopeDispose(clearFocus)
// #endif
</script>
<template>
  <up-popup
    v-if="modelValue"
    :show="modelValue"
    mode="center"
    :round="16"
    :close-on-click-overlay="false"
    :safe-area-inset-bottom="false"
    :duration="0"
    @close="close"
  >
    <view ref="panel" tabindex="-1" class="app-dialog" role="dialog" :aria-label="title" aria-modal="true">
      <view class="subtitle">{{ title }}</view>
      <scroll-view scroll-y class="dialog-body">
        <slot />
        <view v-if="state.error" class="error" role="alert">{{ state.error }}</view>
      </scroll-view>
      <view class="actions">
        <view><AppControl label="取消" secondary @activate="close" /></view>
        <view><AppControl label="确定" :loading="state.pending" @activate="accept" /></view>
      </view>
    </view>
  </up-popup>
</template>
<style scoped>
.app-dialog {
  box-sizing: border-box;
  width: 88vw;
  max-width: 520px;
  max-height: calc(100vh - 32px);
  display: flex;
  flex-direction: column;
  padding: 20px;
  border-radius: 16px;
  background: var(--surface, #fff);
  color: var(--text, #172033);
}
.dialog-body {
  height: 34vh;
  max-height: 320px;
  min-height: 0;
  flex-shrink: 1;
}
.actions {
  flex-shrink: 0;
  display: flex;
  flex-wrap: wrap;
}
.actions > view {
  flex: 1;
  min-width: 90px;
}
/* #ifdef H5 */
.app-dialog {
  max-height: calc(100dvh - 2 * var(--window-top, 0px) - 24px);
}
/* #endif */
</style>
