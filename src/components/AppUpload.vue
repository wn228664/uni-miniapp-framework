<script setup>
import AppControl from './AppControl.vue'
import { onScopeDispose, reactive, ref } from 'vue'
import { createAction } from '../core/action.js'
import { useServices } from '../app/services.js'
import { fail, isCancelled } from '../core/errors.js'
import AppImage from './AppImage.vue'
/**
 * 单图选择/预览；可选 upload(path,{token,onProgress}) 必须返回有效 HTTP(S) URL。
 * change 只交付 URL 或清空值；未提供 upload 时明确保持本地预览模式。
 * maxBytes 校验所选临时文件后才可选压缩；cancel 结束任务，clear 还会清空预览和回填。
 */
// props：只读 upload/compress/maxBytes；upload 默认 null、本地预览模式，大小默认 10MiB。
const props = defineProps({
  /** 属性 upload：可选上传函数 upload(path,{token,onProgress})；默认 null 仅本地预览，成功必须返回 HTTP(S) URL。 */
  upload: { type: Function, default: null },
  /** 属性 compress：选中图片校验后是否压缩，默认 false。 */
  compress: Boolean,
  /** 属性 maxBytes：选中文件的最大字节数，默认 10MiB；空文件或超限立即拒绝。 */
  maxBytes: { type: Number, default: 10 * 1024 * 1024 },
})
// emit：组件事件发布器；只通知父级，由父级决定是否更新受控值或执行业务。
const emit = defineEmits(['change'])
// media：共享的图片选择/压缩服务，每次返回可取消任务。
const { media } = useServices()
// state：本组件选择到上传整个周期的 pending/error，非全局上传状态。
// task：整个单图流程的互斥锁；180000ms 上限，清除/卸载时取消。
const state = reactive({ pending: false, error: '' }),
  task = createAction(state)
// preview：所选/压缩后临时图片路径 ref；不表示上传成功。
// progress：本次上传进度 ref，初值 0；token 有效时才更新。
// remote：已验证 HTTP(S) 的远端 URL；选择新图先清空，不与本地路径混用。
const preview = ref(''),
  progress = ref(0),
  remote = ref('')
/**
 * 互斥选择、校验、可选压缩和上传；取消不报错，失败可重试。
 */
async function choose() {
  if (state.pending) return
  try {
    await task.run(
      /**
       * 以同一 token 串联选择/压缩/上传；只交付当前周期的有效远端 URL。
       * token：本次任务的可取消 token；取消后不能再交付结果，已发生的外部副作用不能撤销。
       */
      async (token) => {
        // result：平台图片选择结果，保留 tempFiles 结构供校验。
        const result = await media.chooseImage({ token }).promise
        // file：本次第一张临时文件；path 必须存在，size 有限、正数且不超过 maxBytes。
        const file = result.tempFiles?.[0]
        if (!file?.path || !Number.isFinite(file.size) || file.size <= 0 || file.size > props.maxBytes)
          throw fail('FILE_SIZE', '图片为空或超过大小限制')
        preview.value = props.compress ? await media.compressImage(file.path, { token }).promise : file.path
        remote.value = ''
        emit('change', '')
        progress.value = 0
        if (props.upload) {
          // url：上传函数成功返回的候选 URL；需验证为 HTTP(S) 字符串才回填。
          const url = await props.upload(preview.value, {
            token,
            onProgress:
              /**
               * token 未取消时发布当前进度；不使用进度表示服务成功。
               * value：上传器报告的 0..100 进度；取消后忽略。
               */
              (value) => {
                if (!token.cancelled) progress.value = value
              },
          })
          if (!token.cancelled) {
            if (typeof url !== 'string' || !/^https?:\/\//i.test(url))
              throw fail('DECODE', '上传服务未返回有效 URL')
            remote.value = url
            emit('change', url)
          }
        }
      },
      { timeoutMs: 180000 },
    )
  } catch (error) {
    // error：当前捕获的失败值；取消类错误不生成新的用户失败提示，其余按所在入口反馈。

    if (!isCancelled(error)) state.error = error.message
  }
}
/**
 * 取消任务并清空临时/远端值、进度与错误，通知父级回填空串。
 */
function clear() {
  task.cancel()
  preview.value = ''
  remote.value = ''
  progress.value = 0
  state.error = ''
  emit('change', '')
}
onScopeDispose(task.dispose)
defineExpose({ cancel: task.cancel, clear })
</script>
<template>
  <view>
    <AppImage v-if="preview" :src="preview" label="所选图片" />
    <view v-if="preview && upload" class="muted">{{ remote ? '上传完成' : `上传进度 ${progress}%` }}</view>
    <view v-if="!upload" class="muted">仅本地选择与预览，未配置上传服务。</view>
    <view class="actions">
      <view><AppControl label="选择图片" :loading="state.pending" @activate="choose" /></view>
      <view v-if="preview || state.pending">
        <AppControl :label="state.pending ? '取消' : '移除'" secondary @activate="clear" />
      </view>
    </view>
    <view v-if="state.error" class="error" role="alert">{{ state.error }}</view>
  </view>
</template>
