<script setup>
import { ref } from 'vue'
import { onHide } from '@dcloudio/uni-app'
import AppPage from '../../components/AppPage.vue'
import AppSwitch from '../../components/AppSwitch.vue'
import AppButton from '../../components/AppButton.vue'
import AppForm from '../../components/AppForm.vue'
import AppDialog from '../../components/AppDialog.vue'
import AppUpload from '../../components/AppUpload.vue'
import AppImage from '../../components/AppImage.vue'
import AppState from '../../components/AppState.vue'
import { usePreferencesStore } from '../../stores/preferences.js'
import { useServices } from '../../app/services.js'
import { required } from '../../utils/index.js'
import { createOperation } from '../../core/operation.js'
const { feedback } = useServices()
const prefs = usePreferencesStore(),
  open = ref(false),
  failDemo = ref(false),
  result = ref(''),
  model = ref({ title: '', note: '' })
const form = ref(null),
  upload = ref(null),
  button = ref(null)
const fields = [
  { name: 'title', label: '必填文本', rules: [required('请输入必填文本')] },
  { name: 'note', label: '备注（保留输入）' },
  {
    name: 'choice',
    label: '通用选择器',
    type: 'select',
    options: [
      { value: 'a', text: '选项 A' },
      { value: 'b', text: '选项 B' },
    ],
  },
  { name: 'date', label: '日期选择', type: 'date' },
]
function localAction(_value, token) {
  return createOperation(
    (resolve, reject) => {
      const timer = setTimeout(
        () => (failDemo.value ? reject(new Error('本地演示失败，请重试')) : resolve('本地验证完成')),
        700,
      )
      return () => clearTimeout(timer)
    },
    { token },
  ).promise
}
async function toggleTheme() {
  prefs.setTheme(prefs.theme === 'light' ? 'dark' : 'light')
}
onHide(() => {
  open.value = false
  form.value?.cancel()
  upload.value?.cancel()
  button.value?.cancel()
})
</script>
<template>
  <AppPage>
    <text class="title">通用组件</text>
    <view class="card row">
      <text>深色外观</text>
      <AppSwitch
        :model-value="prefs.theme === 'dark'"
        label="深色外观"
        @update:model-value="toggleTheme().catch(() => (result = '外观保存失败'))"
      />
    </view>
    <view class="card">
      <text class="subtitle">表单与提交</text>
      <view class="row">
        <text>模拟失败</text>
        <AppSwitch :model-value="failDemo" label="模拟失败" @update:model-value="failDemo = $event" />
      </view>
      <AppForm ref="form" v-model="model" :fields="fields" :submit="localAction" @success="result = $event" />
      <view v-if="result" class="muted spaced" role="status">{{ result }}</view>
    </view>
    <view class="card">
      <text class="subtitle">异步弹窗与任务</text>
      <view class="actions">
        <AppButton label="打开弹窗" :action="() => (open = true)" />
        <AppButton
          ref="button"
          label="执行本地任务"
          secondary
          :action="(token) => feedback.withLoading('本地任务', () => localAction(null, token))"
        />
      </view>
    </view>
    <view class="card">
      <text class="subtitle">图片与选择</text>
      <AppImage label="未配置图片的默认状态" />
      <AppUpload ref="upload" />
    </view>
    <view class="card">
      <text class="subtitle">空态与错误态</text>
      <AppState empty />
      <AppState error="这是一条可重试的演示错误" @retry="result = '已触发重试回调'" />
    </view>
    <AppDialog v-model="open" title="通用确认弹窗" :confirm="(token) => localAction(null, token)">
      <view class="muted">正文在弹窗内部滚动，取消会立即结束当前确认周期。</view>
      <view v-for="i in 8" :key="i" class="muted spaced">
        通用内容 {{ i }}：没有内置业务接口或默认成功码。
      </view>
    </AppDialog>
  </AppPage>
</template>
