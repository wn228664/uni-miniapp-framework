import { onHide, onUnload } from '@dcloudio/uni-app'
import { onScopeDispose } from 'vue'

/**
 * 在页面 setup 注册任务生命周期，隐藏时 cancel，卸载/scope 销毁时 dispose。
 * @param {...Object} tasks 任务 owner 应提供幂等的 cancel/dispose；不提供的方法会被跳过。
 * @returns {Object} {cancel}，允许页面主动取消全部已注册任务。
 * 需要后台继续的任务应交给独立 owner，不要绑定到会隐藏的页面。
 *
 * setup 中把任务归属到 uni 页面 hide/unload 和 Vue scope。
 * tasks：页面拥有的任务句柄列表；每项应提供幂等 cancel/dispose，后台持久任务不应放入。
 */
export function usePageTasks(...tasks) {
  // cancel：页面隐藏或主动离开时取消所有注册任务，不销毁可复用句柄。
  const cancel =
    /**
     * 取消本页全部任务，允许重新显示后再调用。
     */
    () =>
      tasks.forEach(
        /**
         * 向一个 owner 发 cancel，不撤销已发生服务端副作用。
         * task：当前被取消/销毁的任务 owner；缺少对应可选方法时跳过。
         */
        (task) => task.cancel?.(),
      )
  // dispose：页面卸载/scope 销毁时永久释放所有任务。
  const dispose =
    /**
     * 永久释放本页全部 owner，重复调用须安全。
     */
    () =>
      tasks.forEach(
        /**
         * 向一个 owner 发 dispose，阻止卸载后复用。
         * task：当前被取消/销毁的任务 owner；缺少对应可选方法时跳过。
         */
        (task) => task.dispose?.(),
      )
  onHide(cancel)
  onUnload(dispose)
  onScopeDispose(dispose)
  return { cancel }
}
