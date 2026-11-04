<script setup>
import { useServices } from '../app/services.js'
import AppControl from './AppControl.vue'
/**
 * 只用于 navigationStyle=custom 的页面；fixed 时生成占位以保持内容可达。
 * back 通过共享导航服务返回，直接进入时回退首页；胶囊与原生安全区由 uView 处理。
 */
defineProps({
  /** 属性 title：导航标题，默认空串。 */
  title: {
    type: String,
    default: '',
  },

  /** 属性 back：是否显示返回按钮，默认 false；安全返回由共享导航服务执行。 */
  back: Boolean,

  /** 属性 fixed：是否固定并生成占位，默认 false；只用于 custom 导航页。 */
  fixed: Boolean,
})
// navigation：当前会话共享导航服务；back 自带页面栈检查与跳转互斥。
// feedback：平台公开提示服务；导航失败通过 toast 展示。
const { navigation, feedback } = useServices()
/**
 * 调用安全 back；没有上一页时服务跳首页，失败不伪装已返回。
 */
async function goBack() {
  try {
    await navigation.back()
  } catch (error) {
    // error：返回失败或导航互斥拒绝；只向用户反馈公开 message。

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
