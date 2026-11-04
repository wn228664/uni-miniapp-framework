import { onMounted, onScopeDispose, ref } from 'vue'
/**
 * 返回 {online: Ref<boolean>}，只表示设备连接状态，不保证服务端可达。
 * 初值乐观为 true；状态事件优先于迟到的首次查询，scope 销毁时解绑监听并屏蔽回调。
 * 必须在组件 setup 中调用，以便挂载和资源释放属于同一作用域。
 *
 * 在组件 scope 内建立平台网络提示，返回只读消费用的 online ref。
 */
export function useNetwork() {
  // online：连接提示 ref，初值 true；事件或首次查询更新，不能证明后端健康。
  const online = ref(true)
  // active：scope 是否仍存活，初值 true；销毁后屏蔽所有晚到回调。
  // observed：是否已收到新网络事件；true 后首次查询不再覆盖新状态。
  let active = true,
    observed = false
  // changed：平台网络事件监听引用；挂载注册、scope 销毁解除同一引用。
  const changed =
    /**
     * 优先接收新网络事件并标记 observed，阻止旧查询覆盖。
     * event：网络事件含 isConnected；首次查询含 networkType，none 表示离线。
     */
    (event) => {
      if (active) {
        observed = true
        online.value = event.isConnected
      }
    }
  onMounted(
    /**
     * 挂载后先订阅事件，再发一次网络类型查询。
     */
    () => {
      uni.onNetworkStatusChange(changed)
      uni.getNetworkType({
        success:
          /**
           * 只有 scope 活着且尚无更新事件时采纳首次查询结果。
           * event：网络事件含 isConnected；首次查询含 networkType，none 表示离线。
           */
          (event) => {
            if (active && !observed) online.value = event.networkType !== 'none'
          },
      })
    },
  )
  onScopeDispose(
    /**
     * 销毁标记 inactive 并解除平台监听，晚到查询不写状态。
     */
    () => {
      active = false
      uni.offNetworkStatusChange(changed)
    },
  )
  return { online }
}
