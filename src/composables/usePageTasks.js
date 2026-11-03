import { onHide, onUnload } from '@dcloudio/uni-app'
import { onScopeDispose } from 'vue'

/**
 * 在页面 setup 注册任务生命周期，隐藏时 cancel，卸载/scope 销毁时 dispose。
 * @param {...Object} tasks 任务 owner 应提供幂等的 cancel/dispose；不提供的方法会被跳过。
 * @returns {Object} {cancel}，允许页面主动取消全部已注册任务。
 * 需要后台继续的任务应交给独立 owner，不要绑定到会隐藏的页面。
 */
export function usePageTasks(...tasks) {
  const cancel = () => tasks.forEach((task) => task.cancel?.())
  const dispose = () => tasks.forEach((task) => task.dispose?.())
  onHide(cancel)
  onUnload(dispose)
  onScopeDispose(dispose)
  return { cancel }
}
