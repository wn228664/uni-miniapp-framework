<script setup>
import AppPage from '../../components/AppPage.vue'
import AppButton from '../../components/AppButton.vue'
import { useServices } from '../../app/services.js'
import { config } from '../../core/config.js'
const { navigation } = useServices()
</script>
<template>
  <AppPage>
    <text class="title">{{ config.title }}</text>
    <text class="muted">Vue 3 · JavaScript · Pinia · uview-plus</text>
    <view class="card">
      <text class="subtitle">从通用能力开始</text>
      <view class="muted">
        独立的小程序基础工程。首页无需账号与服务端，可通过展示页验证组件、列表和任务状态。
      </view>
      <view class="actions">
        <AppButton label="通用组件" :action="() => navigation.go('/packages/showcase/components')" />
        <AppButton
          label="导航与适配"
          secondary
          :action="() => navigation.go('/packages/showcase/navigation')"
        />
        <AppButton label="列表与任务" secondary :action="() => navigation.go('/packages/showcase/data')" />
      </view>
    </view>
    <view class="card">
      <text class="subtitle">已提供的基础层</text>
      <up-cell-group :border="false">
        <up-cell title="请求与会话" label="超时、取消、旧会话隔离、显式错误" />
        <up-cell title="交互与生命周期" label="同步防重、失败恢复、页面隐藏清理" />
        <up-cell title="组件与布局" label="表单、弹窗、图片、上传与安全区" />
      </up-cell-group>
    </view>
    <view class="muted">当前未接入业务服务。微信 AppID、合法域名及真实设备验证步骤见 README。</view>
  </AppPage>
</template>
