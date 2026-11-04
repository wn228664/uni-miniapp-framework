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
// props：受控 modelValue、字段 schema 和必填 submit；校验/提交只消费快照。
const props = defineProps({
  /** 属性 modelValue：必填的受控标量模型；编辑发出新对象，提交时复制为独立快照。 */
  modelValue: { type: Object, required: true },
  /** 属性 fields：必填字段 schema 数组；每项 name 对应模型键，rules 必须同步返回错误文本或空值。 */
  fields: { type: Array, required: true },
  /** 属性 submit：必填提交函数 submit(snapshot, token)；失败必须拒绝，只有成功才发出 success。 */
  submit: { type: Function, required: true },
})
// emit：组件事件发布器；只通知父级，由父级决定是否更新受控值或执行业务。
const emit = defineEmits(['update:modelValue', 'success'])
// fieldRefs：当前 AppField 实例数组；cancel 时逐个关闭选择层。
const fieldRefs = ref([])
// errors：按字段名保存首个同步校验错误的 ref，初值空对象。
// state：整张表单提交锁与公开错误；与字段校验错误分开。
// task：表单提交 owner，卸载 dispose，父页隐藏调用暴露 cancel。
const errors = ref({}),
  state = reactive({ pending: false, error: '' }),
  task = createAction(state)
onScopeDispose(task.dispose)
/**
 * 以新模型对象更新单字段并清该字段旧错误，保留其它输入。
 * name：用户修改字段的 schema.name；只清除此字段错误。
 * value：该字段的新标量值；合并成新对象发回父级。
 */
function update(name, value) {
  emit('update:modelValue', { ...props.modelValue, [name]: value })
  errors.value = { ...errors.value, [name]: '' }
}
/**
 * 先同步校验，再以独立快照互斥提交；失败留输入，取消不报错。
 */
async function send() {
  if (state.pending) return
  state.error = ''
  try {
    errors.value = validateFields(
      props.modelValue,
      Object.fromEntries(
        props.fields.map(
          /**
           * 把每个字段 schema 的 name/rules 转为验证器索引。
           * field：当前字段 schema，name 建立模型索引，rules 提供同步规则序列。
           */
          (field) => [field.name, field.rules || []],
        ),
      ),
    )
    if (Object.keys(errors.value).length) return
    // 通用字段仅消费标量；提交快照不随父组件替换 model 而变化。
    // snapshot：提交开始时的标量字段浅拷贝；整个请求始终消费这份快照。
    const snapshot = { ...props.modelValue }
    // result：submit 当前有效周期成功结果，仅成功发 success。
    const result = await task.run(
      /**
       * 把提交快照和此周期 token 一起交给父级服务。
       * token：本次任务的可取消 token；取消后不能再交付结果，已发生的外部副作用不能撤销。
       */
      (token) => props.submit(snapshot, token),
    )
    emit('success', result)
  } catch (error) {
    // error：当前捕获的失败值；取消类错误不生成新的用户失败提示，其余按所在入口反馈。

    if (!isCancelled(error)) state.error = error.message || '表单验证失败'
  }
}
/**
 * 中止提交并关闭各字段选择层，不清空受控表单。
 */
function cancel() {
  task.cancel()
  fieldRefs.value.forEach(
    /**
     * 调用单个字段的 close 释放选择层。
     * field：当前挂载的 AppField 实例，close 只关闭选择层。
     */
    (field) => field.close(),
  )
}
defineExpose({ cancel })
</script>
<template>
  <view>
    <!-- field 为当前 schema；以 name 关联受控值与错误，$event 是字段提议的新标量值。 -->
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
