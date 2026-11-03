import { onMounted, onScopeDispose, ref } from 'vue'
/**
 * 返回 {online: Ref<boolean>}，只表示设备连接状态，不保证服务端可达。
 * 初值乐观为 true；状态事件优先于迟到的首次查询，scope 销毁时解绑监听并屏蔽回调。
 * 必须在组件 setup 中调用，以便挂载和资源释放属于同一作用域。
 */
export function useNetwork() {
  const online = ref(true)
  let active = true,
    observed = false
  const changed = (event) => {
    if (active) {
      observed = true
      online.value = event.isConnected
    }
  }
  onMounted(() => {
    uni.onNetworkStatusChange(changed)
    uni.getNetworkType({
      success: (event) => {
        if (active && !observed) online.value = event.networkType !== 'none'
      },
    })
  })
  onScopeDispose(() => {
    active = false
    uni.offNetworkStatusChange(changed)
  })
  return { online }
}
