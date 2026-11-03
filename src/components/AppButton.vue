<script setup>
import { onScopeDispose, reactive } from 'vue'
import { createAction } from '../core/action.js'
import { isCancelled } from '../core/errors.js'
import AppControl from './AppControl.vue'
/**
 * action(token) 必填，由本组件拥有该次异步任务；成功才发出 done(result)。
 * 暴露 cancel()，离页时由父页调用；失败保留提示，取消不生成新的失败提示。
 */
const props = defineProps({
  action: { type: Function, required: true },
  disabled: Boolean,
  loading: Boolean,
  secondary: Boolean,
  label: { type: String, default: '确定' },
})
const emit = defineEmits(['done'])
const state = reactive({ pending: false, error: '' })
const task = createAction(state)
onScopeDispose(task.dispose)
async function click() {
  if (state.pending || props.disabled || props.loading) return
  try {
    const result = await task.run((token) => props.action(token))
    emit('done', result)
  } catch (error) {
    if (!isCancelled(error) && error.code !== 'BUSY') state.error = error.message
  }
}
defineExpose({ cancel: task.cancel })
</script>
<template>
  <view>
    <AppControl
      :label="label"
      :secondary="secondary"
      :disabled="disabled || loading"
      :loading="loading || state.pending"
      @activate="click"
    />
    <view v-if="state.error" class="error" role="alert">{{ state.error }}</view>
  </view>
</template>
