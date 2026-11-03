<script setup>
import AppPage from '../../components/AppPage.vue'
import AppNavbar from '../../components/AppNavbar.vue'
import AppButton from '../../components/AppButton.vue'
</script>
<template>
  <AppPage flush>
    <AppNavbar title="导航与适配" back fixed />
    <view class="navigation-demo">
      <view class="card">
        <view class="subtitle">自定义导航栏</view>
        <view class="muted">
          此页已配置 custom
          导航；返回交给统一导航服务，直接打开时有首页兜底。微信胶囊与安全区需在微信环境验收。
        </view>
      </view>
      <view class="card">
        <view class="subtitle">长内容与触控区域</view>
        <AppButton
          label="这是一段较长的操作文案，用于确认窄屏换行后仍能完整显示和点击"
          :action="() => undefined"
        />
        <view class="spaced"><AppButton label="禁用状态" disabled :action="() => undefined" /></view>
        <view class="muted spaced">
          长文本使用自然换行，页面保留原生滚动；弹窗等局部区域拥有独立滚动容器。
        </view>
      </view>
    </view>
  </AppPage>
</template>
<style scoped>
.navigation-demo {
  padding: 0 16px;
}
</style>
