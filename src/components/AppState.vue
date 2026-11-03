<script setup>
import AppControl from './AppControl.vue'
/** 状态优先级为 loading > error > empty > 默认插槽；retry 只通知父级，不把失败伪装为空态。 */
defineProps({ loading: Boolean, error: { type: String, default: '' }, empty: Boolean })
defineEmits(['retry'])
</script>
<template>
  <view>
    <view v-if="loading" role="status" aria-label="正在加载">
      <view v-for="index in 3" :key="index" class="skeleton" />
    </view>
    <view v-else-if="error" class="card">
      <view class="error" role="alert">{{ error }}</view>
      <view class="spaced"><AppControl label="重试" secondary @activate="$emit('retry')" /></view>
    </view>
    <view v-else-if="empty" class="card muted">暂无内容</view>
    <slot v-else />
  </view>
</template>
