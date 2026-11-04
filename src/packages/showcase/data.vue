<script setup>
/** 纯本地分页示例：每页五项共三页，400ms 是可取消加载夹具；稳定 id 按目标页和零基索引计算。模板 item 为分页器去重后的当前行，不包含真实业务数据。 */

import { reactive, ref } from 'vue'
import { onLoad, onShow, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import AppPage from '../../components/AppPage.vue'
import AppSwitch from '../../components/AppSwitch.vue'
import AppList from '../../components/AppList.vue'
import { createPagination } from '../../core/pagination.js'
import { createOperation } from '../../core/operation.js'
import { usePageTasks } from '../../composables/usePageTasks.js'
import { isCancelled } from '../../core/errors.js'
// failDemo：本地 loader 失败开关，初值 false；重试前可关闭。
const failDemo = ref(false)
// autoLoad：触底自动加载开关，初值 false，手动加载始终可用。
const autoLoad = ref(false)
// state：共享给 pager/AppList 的 reactive 分页状态；初始空列表、page=0。
const state = reactive({ items: [], page: 0, pending: false, refreshing: false, hasMore: true, error: '' })
// 明确标记本地示例数据，loader 边界可替换为新应用的真实服务。
// pager：本页的分页 owner，usePageTasks 负责 hide 取消与 unload 销毁。
const pager = createPagination({
  state,
  pageSize: 5,
  load:
    /**
     * 建立 400ms 可取消本地页加载，返回 items/hasMore 明确契约。
     * page：夹具请求的 1 基目标页码，用于生成稳定 id 和判断 hasMore。
     * pageSize：当前分页容量，固定由 pager 配置为 5。
     * token：本次任务的可取消 token；取消后不能再交付结果，已发生的外部副作用不能撤销。
     */
    ({ page, pageSize, token }) =>
      createOperation(
        /**
         * 把本页成功/失败夹具接到独立 operation，返回 timer 清理。
         * resolve：当前 Promise 的成功终结器；交付载荷，不代表业务接口成功。
         * reject：当前 Promise 的失败终结器；保留取消、超时和平台失败的拒绝通道。
         */
        (resolve, reject) => {
          // timer：本轮本地等待的 setTimeout 句柄；取消函数清除，不跨任务共享。
          const timer = setTimeout(
            /**
             * 按失败开关或三页夹具产出结果，不从数组长度猜 hasMore。
             */
            () =>
              failDemo.value
                ? reject(new Error('本地列表演示失败'))
                : resolve({
                    items: Array.from(
                      { length: pageSize },
                      /**
                       * 按目标页和零基位置生成稳定 id 以及中性展示标题。
                       * _：Array.from 未使用的槽位值，标记不依赖其内容。
                       * i：夹具当前页零基索引，范围 0..pageSize-1；仅用于本地 id/title。
                       */
                      (_, i) => ({
                        id: (page - 1) * pageSize + i + 1,
                        title: `框架示例 ${(page - 1) * pageSize + i + 1}`,
                      }),
                    ),
                    hasMore: page < 3,
                  }),
            400,
          )
          return (
            /**
             * 取消本页夹具 timer，禁止离页后继续执行。
             */
            () => clearTimeout(timer)
          )
        },
        { token },
      ).promise,
})
usePageTasks(pager)
/**
 * 执行刷新或下一页；取消不提示，任意出口结束平台下拉指示。
 * refresh：run 的刷新标志，默认 false；true 调第一页替换模式。
 */
async function run(refresh = false) {
  try {
    await (refresh ? pager.refresh() : pager.next())
  } catch (error) {
    // error：当前捕获的失败值；取消类错误不生成新的用户失败提示，其余按所在入口反馈。

    if (!isCancelled(error)) state.error = error.message
  } finally {
    uni.stopPullDownRefresh()
  }
}
onLoad(
  /**
   * 首次加载请求第一页；动作锁防止 onShow 重复并发。
   */
  () => run(),
)
onShow(
  /**
   * 重新显示且还没有成功页时补加载，已有数据不重复初始化。
   */
  () => {
    if (state.page === 0 && !state.pending) run()
  },
)
onPullDownRefresh(
  /**
   * 平台下拉触发完整刷新，旧页被取消隔离。
   */
  () => run(true),
)
onReachBottom(
  /**
   * 只有 autoLoad 打开时才在触底请求下一页。
   */
  () => {
    if (autoLoad.value) run()
  },
)
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
      <!-- item 为 AppList 交付的当前行，本地 fixture 仅包含稳定 id 与中性 title。 -->
      <template #default="{ item }">
        <view class="card">
          <text class="subtitle">{{ item.title }}</text>
          <view class="muted">分页项 {{ item.id }}，通过稳定 ID 去重。</view>
        </view>
      </template>
    </AppList>
  </AppPage>
</template>
