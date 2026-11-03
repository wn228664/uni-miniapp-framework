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
const props = defineProps({
  upload: { type: Function, default: null },
  compress: Boolean,
  maxBytes: { type: Number, default: 10 * 1024 * 1024 },
})
const emit = defineEmits(['change'])
const { media } = useServices()
const state = reactive({ pending: false, error: '' }),
  task = createAction(state)
const preview = ref(''),
  progress = ref(0),
  remote = ref('')
async function choose() {
  if (state.pending) return
  try {
    await task.run(
      async (token) => {
        const result = await media.chooseImage({ token }).promise
        const file = result.tempFiles?.[0]
        if (!file?.path || !Number.isFinite(file.size) || file.size <= 0 || file.size > props.maxBytes)
          throw fail('FILE_SIZE', '图片为空或超过大小限制')
        preview.value = props.compress ? await media.compressImage(file.path, { token }).promise : file.path
        remote.value = ''
        emit('change', '')
        progress.value = 0
        if (props.upload) {
          const url = await props.upload(preview.value, {
            token,
            onProgress: (value) => {
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
    if (!isCancelled(error)) state.error = error.message
  }
}
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
