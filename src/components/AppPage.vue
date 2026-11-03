<script setup>
import { usePreferencesStore } from '../stores/preferences.js'
import { useNetwork } from '../composables/useNetwork.js'
/** 页面容器维护主题、宽度和断网提示；flush 仅移除顶部/左右留白，底部安全区仍保留。 */
defineProps({ flush: Boolean })
const prefs = usePreferencesStore()
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
