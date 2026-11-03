<script setup>
import { onScopeDispose, reactive, ref } from 'vue'
import { createAction } from '../core/action.js'
import { validateFields } from '../utils/index.js'
import { isCancelled } from '../core/errors.js'
import AppControl from './AppControl.vue'
import AppField from './AppField.vue'
/**
 * fields 描述标量字段和同步规则；必填 submit(snapshot,token) 承担真实提交。
 * 验证失败保留输入，成功才发出 success(result)；暴露 cancel() 同时关闭字段选择层。
 * 父页隐藏时应 cancel，不把 loading 当作服务端幂等或权限保证。
 */
const props = defineProps({
  modelValue: { type: Object, required: true },
  fields: { type: Array, required: true },
  submit: { type: Function, required: true },
})
const emit = defineEmits(['update:modelValue', 'success'])
const fieldRefs = ref([])
const errors = ref({}),
  state = reactive({ pending: false, error: '' }),
  task = createAction(state)
onScopeDispose(task.dispose)
function update(name, value) {
  emit('update:modelValue', { ...props.modelValue, [name]: value })
  errors.value = { ...errors.value, [name]: '' }
}
async function send() {
  if (state.pending) return
  state.error = ''
  try {
    errors.value = validateFields(
      props.modelValue,
      Object.fromEntries(props.fields.map((field) => [field.name, field.rules || []])),
    )
    if (Object.keys(errors.value).length) return
    // 通用字段仅消费标量；提交快照不随父组件替换 model 而变化。
    const snapshot = { ...props.modelValue }
    const result = await task.run((token) => props.submit(snapshot, token))
    emit('success', result)
  } catch (error) {
    if (!isCancelled(error)) state.error = error.message || '表单验证失败'
  }
}
function cancel() {
  task.cancel()
  fieldRefs.value.forEach((field) => field.close())
}
defineExpose({ cancel })
</script>
<template>
  <view>
    <AppField
      ref="fieldRefs"
      v-for="field in fields"
      :key="field.name"
      :field="field"
      :model-value="modelValue[field.name]"
      :disabled="state.pending"
      :error="errors[field.name]"
      @update:model-value="update(field.name, $event)"
      @confirm="send"
    />
    <view v-if="state.error" class="error" role="alert">{{ state.error }}</view>
    <AppControl label="提交" :loading="state.pending" @activate="send" />
  </view>
</template>
