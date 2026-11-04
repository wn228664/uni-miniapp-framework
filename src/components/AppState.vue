<script setup>
/** 统一加载/错误/空态展示，默认插槽承载成功内容。loading 优先，其次 error，再次 empty；retry 仅通知父级。模板 index 是三行骨架的循环序号，不是业务 ID。 */

import AppControl from './AppControl.vue'
/** 状态优先级为 loading > error > empty > 默认插槽；retry 只通知父级，不把失败伪装为空态。 */
defineProps({
  /** 属性 loading：最高优先级加载状态，默认 false；显示三行骨架。 */
  loading: Boolean,

  /** 属性 error：加载错误文本，默认空串；非空时显示重试入口。 */
  error: { type: String, default: '' },

  /** 属性 empty：无数据状态，优先级低于 loading/error，默认 false。 */
  empty: Boolean,
})
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
