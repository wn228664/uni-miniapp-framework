<script setup>
import { useServices } from '../app/services.js'
import AppControl from './AppControl.vue'
/**
 * 只用于 navigationStyle=custom 的页面；fixed 时生成占位以保持内容可达。
 * back 通过共享导航服务返回，直接进入时回退首页；胶囊与原生安全区由 uView 处理。
 */
defineProps({ title: { type: String, default: '' }, back: Boolean, fixed: Boolean })
const { navigation, feedback } = useServices()
async function goBack() {
  try {
    await navigation.back()
  } catch (error) {
    feedback.toast(error.message)
  }
}
</script>
<template>
  <up-navbar
    :title="title"
    title-width="50vw"
    :fixed="fixed"
    :placeholder="fixed"
    :auto-back="false"
    :height="52"
    :left-icon="back ? 'arrow-left' : ''"
    :safe-area-inset-top="true"
  >
    <template #left><AppControl v-if="back" label="返回" secondary @activate="goBack" /></template>
    <template #right><slot /></template>
  </up-navbar>
</template>
