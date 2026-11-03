<script setup>
import { reactive, ref } from 'vue'
import { onLoad, onShow, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import AppPage from '../../components/AppPage.vue'
import AppSwitch from '../../components/AppSwitch.vue'
import AppList from '../../components/AppList.vue'
import { createPagination } from '../../core/pagination.js'
import { createOperation } from '../../core/operation.js'
import { usePageTasks } from '../../composables/usePageTasks.js'
import { isCancelled } from '../../core/errors.js'
const failDemo = ref(false)
const autoLoad = ref(false)
const state = reactive({ items: [], page: 0, pending: false, refreshing: false, hasMore: true, error: '' })
// 明确标记本地示例数据，loader 边界可替换为新应用的真实服务。
const pager = createPagination({
  state,
  pageSize: 5,
  load: ({ page, pageSize, token }) =>
    createOperation(
      (resolve, reject) => {
        const timer = setTimeout(
          () =>
            failDemo.value
              ? reject(new Error('本地列表演示失败'))
              : resolve({
                  items: Array.from({ length: pageSize }, (_, i) => ({
                    id: (page - 1) * pageSize + i + 1,
                    title: `框架示例 ${(page - 1) * pageSize + i + 1}`,
                  })),
                  hasMore: page < 3,
                }),
          400,
        )
        return () => clearTimeout(timer)
      },
      { token },
    ).promise,
})
usePageTasks(pager)
async function run(refresh = false) {
  try {
    await (refresh ? pager.refresh() : pager.next())
  } catch (error) {
    if (!isCancelled(error)) state.error = error.message
  } finally {
    uni.stopPullDownRefresh()
  }
}
onLoad(() => run())
onShow(() => {
  if (state.page === 0 && !state.pending) run()
})
onPullDownRefresh(() => run(true))
onReachBottom(() => {
  if (autoLoad.value) run()
})
</script>
<template>
  <AppPage>
    <text class="title">列表与任务</text>
    <view class="card row">
      <text>模拟加载失败</text>
      <AppSwitch :model-value="failDemo" label="模拟加载失败" @update:model-value="failDemo = $event" />
    </view>
    <view class="card row">
      <text>滚动自动加载</text>
      <AppSwitch :model-value="autoLoad" label="滚动自动加载" @update:model-value="autoLoad = $event" />
    </view>
    <view class="muted spaced">当前使用本地示例 loader，支持刷新、分页、重试和离页取消。</view>
    <AppList v-bind="state" @refresh="run(true)" @more="run()">
      <template #default="{ item }">
        <view class="card">
          <text class="subtitle">{{ item.title }}</text>
          <view class="muted">分页项 {{ item.id }}，通过稳定 ID 去重。</view>
        </view>
      </template>
    </AppList>
  </AppPage>
</template>
