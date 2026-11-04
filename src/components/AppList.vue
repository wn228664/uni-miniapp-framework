<script setup>
/** 列表只消费 items/pending/refreshing/hasMore/error，加载交父级。itemKey 默认 id，可传函数，须和分页器 keyOf 一致；默认插槽输出 item 行对象和 index 零基位置，稳定 key 决定行身份。more/refresh 由父级执行。 */

import AppControl from './AppControl.vue'
import AppState from './AppState.vue'
/**
 * 只渲染父级提供的数据，不发请求；more/refresh 交给拥有分页控制器的父级处理。
 * itemKey 默认为 id，可用属性名或函数，必须与分页 keyOf 一致；item/index 经插槽交付。
 */
defineProps({
  /** 属性 items：当前已有行集合，默认每实例独立空数组；失败不清空旧行。 */
  items: {
    type: Array,
    default:
      /**
       * 为每个列表实例提供独立空数组，避免默认集合跨实例共享。
       */
      () => [],
  },
  /** 属性 pending：正在请求下一页，首屏无行时显示骨架。 */
  pending: Boolean,
  /** 属性 refreshing：正在刷新第一页，控制刷新入口等待。 */
  refreshing: Boolean,
  /** 属性 hasMore：由分页服务显式给出的后续页状态，不从当前行数猜测。 */
  hasMore: Boolean,
  /** 属性 error：当前公开加载错误，默认空串；已有行时在底部保留重试。 */
  error: { type: String, default: '' },
  /** 属性 itemKey：行身份的属性名或函数，默认 id；应与分页服务 keyOf 一致。 */
  itemKey: { type: [String, Function], default: 'id' },
})
defineEmits(['more', 'refresh'])
</script>
<template>
  <view>
    <AppControl label="刷新列表" secondary :loading="refreshing" @activate="$emit('refresh')" />
    <AppState
      :loading="pending && items.length === 0"
      :error="items.length === 0 ? error : ''"
      :empty="!pending && !error && items.length === 0"
      @retry="$emit('more')"
    >
      <slot
        v-for="(item, index) in items"
        :key="typeof itemKey === 'function' ? itemKey(item) : item[itemKey]"
        :item="item"
        :index="index"
      />
    </AppState>
    <view v-if="items.length" class="spaced">
      <view v-if="error" class="error" role="alert">{{ error }}</view>
      <AppControl
        v-if="hasMore || error"
        :label="error ? '加载失败，重试' : '加载更多'"
        secondary
        :loading="pending"
        @activate="$emit('more')"
      />
      <view v-else class="muted">已加载全部内容</view>
    </view>
  </view>
</template>
