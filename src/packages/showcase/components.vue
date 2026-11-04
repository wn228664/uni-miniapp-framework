<script setup>
/** 纯本地组件演示：表单/按钮/对话框共用可取消 localAction，700ms 只是测试夹具；无远端业务请求。隐藏页取消子任务、关闭弹窗；v-for i 是八段长文案序号。模板 token 传给本地任务，$event 为组件已验证结果，不能冒充服务端成功。 */

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
// feedback：全局加载 owner 服务，本地任务用 withLoading 成对显示/关闭。
const { feedback } = useServices()
// prefs：共享外观偏好 store，light/dark 切换写入成功才更新。
// open：本地对话框显示状态，初值 false；页隐藏强制关闭。
// failDemo：本地模拟失败开关，初值 false；只影响定时夹具结果。
// result：最近一次本地操作的公开反馈文本，初值空。
// model：受控表单标量对象，初值 title/note 空；失败不清输入。
const prefs = usePreferencesStore(),
  open = ref(false),
  failDemo = ref(false),
  result = ref(''),
  model = ref({ title: '', note: '' })
// form：AppForm 引用，隐藏调用 cancel 释放提交和选择层。
// upload：AppUpload 引用，隐藏取消选择/上传等待。
// button：异步按钮引用，隐藏取消本地任务。
const form = ref(null),
  upload = ref(null),
  button = ref(null)
// fields：中性字段 schema：title 必填、note/choice/date 可选，不含业务字段。
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
/**
 * 用 700ms 可取消夹具模拟成功/失败，不发远端请求。
 * _value：本地演示不使用的提交快照，占位保留 submit(value,token) 兼容签名。
 * token：本次任务的可取消 token；取消后不能再交付结果，已发生的外部副作用不能撤销。
 */
function localAction(_value, token) {
  return createOperation(
    /**
     * 安装本轮本地演示计时器，返回 clearTimeout 中止器。
     * resolve：当前 Promise 的成功终结器；交付载荷，不代表业务接口成功。
     * reject：当前 Promise 的失败终结器；保留取消、超时和平台失败的拒绝通道。
     */
    (resolve, reject) => {
      // timer：本轮本地等待的 setTimeout 句柄；取消函数清除，不跨任务共享。
      const timer = setTimeout(
        /**
         * 根据 failDemo 明确成功或失败，不把异常改成成功。
         */
        () => (failDemo.value ? reject(new Error('本地演示失败，请重试')) : resolve('本地验证完成')),
        700,
      )
      return (
        /**
         * 取消本地演示 timer，阻止隐藏后迟到结果。
         */
        () => clearTimeout(timer)
      )
    },
    { token },
  ).promise
}
/**
 * 切换并持久化合法主题；保存失败交模板 catch 显示。
 */
async function toggleTheme() {
  prefs.setTheme(prefs.theme === 'light' ? 'dark' : 'light')
}
onHide(
  /**
   * 页面隐藏关闭弹窗并取消表单/上传/按钮任务，保留表单草稿。
   */
  () => {
    open.value = false
    form.value?.cancel()
    upload.value?.cancel()
    button.value?.cancel()
  },
)
</script>
<template>
  <AppPage>
    <text class="title">通用组件</text>
    <view class="card row">
      <text>深色外观</text>
      <!-- 无参失败回调只把主题保存错误写入 result；偏好写入失败不改已生效主题。 -->
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
        <!-- 无参 action 同步打开受控弹窗，由弹窗另行持有确认任务。 -->
        <AppButton label="打开弹窗" :action="() => (open = true)" />
        <!-- token 为按钮当前任务令牌；内层无参工厂把同一令牌交给本地任务，loading owner 独立清理。 -->
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
    <!-- confirm 的 token 来自本次弹窗确认，关闭即取消；不使用真实后端。 -->
    <AppDialog v-model="open" title="通用确认弹窗" :confirm="(token) => localAction(null, token)">
      <view class="muted">正文在弹窗内部滚动，取消会立即结束当前确认周期。</view>
      <!-- i 为八段本地长文案的一基序号，只验证弹层内部滚动。 -->
      <view v-for="i in 8" :key="i" class="muted spaced">
        通用内容 {{ i }}：没有内置业务接口或默认成功码。
      </view>
    </AppDialog>
  </AppPage>
</template>
