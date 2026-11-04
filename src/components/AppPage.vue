<script setup>
import { usePreferencesStore } from '../stores/preferences.js'
import { useNetwork } from '../composables/useNetwork.js'
/** 页面容器维护主题、宽度和断网提示；flush 仅移除顶部/左右留白，底部安全区仍保留。 */
defineProps({
  /** 属性 flush：移除顶部和左右内边距，默认 false；底部安全区仍保留。 */ flush: Boolean,
})
// prefs：应用非敏感外观 store；theme 选择容器主题变量。
const prefs = usePreferencesStore()
// online：useNetwork 的连接状态 ref，初值乐观 true；仅表示连接提示，不保证接口可达。
const { online } = useNetwork()
</script>
<template>
  <view class="app-page" :class="[`theme-${prefs.theme}`, { 'page-flush': flush }]">
    <view class="content">
      <view v-if="!online" class="card" role="status">网络连接已断开，内容仍保留。</view>
      <slot />
    </view>
  </view>
</template>
