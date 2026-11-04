<script setup>
import { ref, watch } from 'vue'
/** src 可为网络或临时图片路径；无图/加载失败显示占位，label 提供可访问名称，src 改变后重新尝试加载。 */
// props：只读 src/label；src 默认空、label 默认图片，图片来源由调用方保证。
const props = defineProps({
  /** 属性 src：网络或临时图片地址，默认空串；变更后允许重新加载。 */
  src: { type: String, default: '' },

  /** 属性 label：图片可访问名称，默认“图片”，失败占位仍保留语义。 */
  label: { type: String, default: '图片' },
})
// failed：当前 src 的失败标记，初值 false；换 src 后允许重新加载。
const failed = ref(false)
watch(
  /**
   * 观察图片地址变化，不观察其它展示属性。
   */
  () => props.src,
  /**
   * 新图片地址到来后复位失败，允许实际平台再次加载。
   */
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
