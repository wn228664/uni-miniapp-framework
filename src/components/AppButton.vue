<script setup>
/** 异步按钮：action(token) 必填；label 默认确定，disabled/loading 阻止入口，secondary 只改外观。state/task 拥有此按钮任务；成功发 done(result)，失败保留输入与提示，cancel/卸载不再通知旧结果。 */

import { onScopeDispose, reactive } from 'vue'
import { createAction } from '../core/action.js'
import { isCancelled } from '../core/errors.js'
import AppControl from './AppControl.vue'
/**
 * action(token) 必填，由本组件拥有该次异步任务；成功才发出 done(result)。
 * 暴露 cancel()，离页时由父页调用；失败保留提示，取消不生成新的失败提示。
 */
// props：父级只读 action/外观/禁用配置；action 必须消费取消 token。
const props = defineProps({
  /** 属性 action：必填异步动作，接收取消 token；拒绝保留失败提示，成功才发 done。 */
  action: { type: Function, required: true },
  /** 属性 disabled：父级显式禁用入口，默认 false。 */
  disabled: Boolean,
  /** 属性 loading：父级已有等待状态，与组件自身 pending 一起阻止点击。 */
  loading: Boolean,
  /** 属性 secondary：是否使用次级按钮外观，默认 false，不改变任务语义。 */
  secondary: Boolean,
  /** 属性 label：按钮文字和可访问名称，默认“确定”。 */
  label: { type: String, default: '确定' },
})
// emit：组件事件发布器；只通知父级，由父级决定是否更新受控值或执行业务。
const emit = defineEmits(['done'])
// state：按钮独占的响应式 pending/error，初始 false/空串。
const state = reactive({ pending: false, error: '' })
// task：按钮动作锁；卸载 dispose，父页可经暴露 cancel 主动取消。
const task = createAction(state)
onScopeDispose(task.dispose)
/**
 * 同步拦截重复/禁用入口；失败恢复为可重试，取消不报错。
 */
async function click() {
  if (state.pending || props.disabled || props.loading) return
  try {
    // result：action 在当前周期成功交付的结果；只此时发 done。
    const result = await task.run(
      /**
       * 把当前任务 token 交给父级 action，不私自重试。
       * token：本次任务的可取消 token；取消后不能再交付结果，已发生的外部副作用不能撤销。
       */
      (token) => props.action(token),
    )
    emit('done', result)
  } catch (error) {
    // error：当前捕获的失败值；取消类错误不生成新的用户失败提示，其余按所在入口反馈。

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
