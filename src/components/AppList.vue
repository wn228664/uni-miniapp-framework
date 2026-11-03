<script setup>
import AppControl from './AppControl.vue'
import AppState from './AppState.vue'
/**
 * 只渲染父级提供的数据，不发请求；more/refresh 交给拥有分页控制器的父级处理。
 * itemKey 默认为 id，可用属性名或函数，必须与分页 keyOf 一致；item/index 经插槽交付。
 */
defineProps({
  items: { type: Array, default: () => [] },
  pending: Boolean,
  refreshing: Boolean,
  hasMore: Boolean,
  error: { type: String, default: '' },
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
