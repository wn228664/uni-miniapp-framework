<script setup>
import { ref, watch } from 'vue'
/** src 可为网络或临时图片路径；无图/加载失败显示占位，label 提供可访问名称，src 改变后重新尝试加载。 */
const props = defineProps({ src: { type: String, default: '' }, label: { type: String, default: '图片' } })
const failed = ref(false)
watch(
  () => props.src,
  () => {
    failed.value = false
  },
)
</script>
<template>
  <view class="app-image">
    <image v-if="src && !failed" :src="src" mode="aspectFill" :aria-label="label" @error="failed = true" />
    <view v-else class="muted" role="img" :aria-label="`${label}不可用`">图片不可用</view>
  </view>
</template>
<style scoped>
.app-image {
  height: 160px;
  background: var(--canvas);
  border: 1px solid var(--line);
  border-radius: 10px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}
.app-image image {
  width: 100%;
  height: 100%;
}
</style>
