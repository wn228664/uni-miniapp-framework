<script setup>
import { nextTick, onScopeDispose, reactive, ref, watch } from 'vue'
import { createAction } from '../core/action.js'
import { isCancelled } from '../core/errors.js'
import AppControl from './AppControl.vue'
/**
 * modelValue 控制可见性，confirm(token) 必填；成功发 confirmed 并关闭，失败留窗。
 * 关闭会卸载局部内容，需保留的表单放在父组件；父页隐藏时应将 modelValue 置 false。
 * H5 焦点与正文滚动在此维护，微信平台行为须单独验收。
 */
// props：父级 modelValue/title/confirm；confirm 必填，标题默认提示。
const props = defineProps({
  /** 属性 modelValue：由父级控制的显示状态，开关变化立即取消旧确认。 */
  modelValue: Boolean,
  /** 属性 title：对话框标题和可访问名称，默认“提示”。 */
  title: { type: String, default: '提示' },
  /** 属性 confirm：必填确认函数，接收 token 并返回 Promise；失败时保留弹窗。 */
  confirm: { type: Function, required: true },
})
// emit：组件事件发布器；只通知父级，由父级决定是否更新受控值或执行业务。
const emit = defineEmits(['update:modelValue', 'confirmed'])
// panel：H5 弹层 DOM/组件引用，初值 null；只在 H5 条件编译内访问。
const panel = ref(null)
// state：本弹窗周期的 pending/error；重新开关立即清空旧错误。
// task：确认动作锁；关闭取消、卸载永久 dispose。
const state = reactive({ pending: false, error: '' }),
  task = createAction(state)
// 每次打开均拥有独立任务周期；外部关闭与取消按钮都使旧结果失效。
watch(
  /**
   * 读取父级可见性，作为确认周期变化源。
   */
  () => props.modelValue,
  /**
   * 每次开关取消旧确认并清空错误，flush sync 阻止旧结果回填。
   */
  () => {
    task.cancel()
    state.error = ''
  },
  { flush: 'sync' },
)
/**
 * 取消当前确认，再请求父级关闭弹层。
 */
function close() {
  task.cancel()
  emit('update:modelValue', false)
}
/**
 * 互斥执行父级确认；成功仍开着才发 confirmed 并关闭，失败留窗。
 */
async function accept() {
  if (state.pending) return
  try {
    await task.run(props.confirm)
    if (props.modelValue) {
      emit('confirmed')
      close()
    }
  } catch (error) {
    // error：当前捕获的失败值；取消类错误不生成新的用户失败提示，其余按所在入口反馈。

    if (!isCancelled(error)) state.error = error.message
  }
}
onScopeDispose(task.dispose)
// #ifdef H5
// Web 弹层隔离键盘焦点；小程序不访问 DOM，使用平台的读屏与输入行为。
// focusRevision：H5 打开周期号，初值 0；跨 nextTick 再校验，防止晚到抢焦点。
let focusRevision = 0
// releaseFocus：当前 H5 监听清理器；未安装时为空函数，重复清理安全。
let releaseFocus =
  /**
   * 尚无焦点监听时的空清理器。
   */
  () => {}
/**
 * 使旧焦点等待失效，执行旧清理并复位为空清理器。
 */
function clearFocus() {
  focusRevision++
  releaseFocus()
  releaseFocus =
    /**
     * 已清理后的空函数，允许重复 clearFocus。
     */
    () => {}
}
watch(
  /**
   * H5 焦点 watch 的可见性来源。
   */
  () => props.modelValue,
  /**
   * 开窗后等待 DOM 就绪，校验周期后装捕获键盘监听与初始焦点。
   * open：父级最新可见状态；false 只清理，true 才等待 DOM 装焦点。
   */
  async (open) => {
    clearFocus()
    if (!open) return
    // mine：跨 nextTick 保存的焦点周期号；与 focusRevision 不同即丢弃。
    const mine = focusRevision
    // previous：开窗前焦点节点；关闭后仍在文档内才恢复。
    const previous = document.activeElement
    await nextTick()
    if (mine !== focusRevision || !props.modelValue) return
    // element：解析 panel.$el 或 panel 的真实 H5 容器，缺失时不装键盘监听。
    const element = panel.value?.$el || panel.value
    if (!element) return
    // candidates：即时查询弹层内可见且可聚焦节点，避免缓存过期列表。
    const candidates =
      /**
       * 每次按键重新查询可聚焦元素，过滤禁用和不可见节点。
       */
      () =>
        [...element.querySelectorAll('button,input,textarea,select,[tabindex]')].filter(
          /**
           * 判断节点是否有实际可聚焦位置。
           * node：候选 DOM 节点，禁用、不可见、负 tabIndex 或 aria-disabled 时排除。
           */
          (node) =>
            !node.disabled &&
            node.tabIndex >= 0 &&
            node.getClientRects().length &&
            node.getAttribute('aria-disabled') !== 'true',
        )
    /**
     * Escape 走同一取消关闭路径；Tab/Shift+Tab 在弹层首尾循环。
     * event：H5 捕获阶段键盘事件；仅处理 Escape 和 Tab，阻止焦点跑出弹层。
     */
    function keydown(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
        return
      }
      if (event.key !== 'Tab') return
      // nodes：本次 Tab 事件取得的候选节点快照。
      // first：候选首节点，无可聚焦子项时回退弹层容器。
      // last：候选末节点，无可聚焦子项时回退弹层容器。
      const nodes = candidates(),
        first = nodes[0] || element,
        last = nodes[nodes.length - 1] || element
      if (
        !element.contains(document.activeElement) ||
        (event.shiftKey && document.activeElement === first) ||
        (!event.shiftKey && document.activeElement === last)
      ) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
      }
    }
    document.addEventListener('keydown', keydown, true)
    releaseFocus =
      /**
       * 解除本周期 keydown，并只向仍连入文档的原节点恢复焦点。
       */
      () => {
        document.removeEventListener('keydown', keydown, true)
        if (previous?.isConnected) previous.focus()
      }
    ;(candidates()[0] || element).focus()
  },
  { flush: 'post', immediate: true },
)
onScopeDispose(clearFocus)
// #endif
</script>
<template>
  <up-popup
    v-if="modelValue"
    :show="modelValue"
    mode="center"
    :round="16"
    :close-on-click-overlay="false"
    :safe-area-inset-bottom="false"
    :duration="0"
    @close="close"
  >
    <view ref="panel" tabindex="-1" class="app-dialog" role="dialog" :aria-label="title" aria-modal="true">
      <view class="subtitle">{{ title }}</view>
      <scroll-view scroll-y class="dialog-body">
        <slot />
        <view v-if="state.error" class="error" role="alert">{{ state.error }}</view>
      </scroll-view>
      <view class="actions">
        <view><AppControl label="取消" secondary @activate="close" /></view>
        <view><AppControl label="确定" :loading="state.pending" @activate="accept" /></view>
      </view>
    </view>
  </up-popup>
</template>
<style scoped>
.app-dialog {
  box-sizing: border-box;
  width: 88vw;
  max-width: 520px;
  max-height: calc(100vh - 32px);
  display: flex;
  flex-direction: column;
  padding: 20px;
  border-radius: 16px;
  background: var(--surface, #fff);
  color: var(--text, #172033);
}
.dialog-body {
  height: 34vh;
  max-height: 320px;
  min-height: 0;
  flex-shrink: 1;
}
.actions {
  flex-shrink: 0;
  display: flex;
  flex-wrap: wrap;
}
.actions > view {
  flex: 1;
  min-width: 90px;
}
/* #ifdef H5 */
.app-dialog {
  max-height: calc(100dvh - 2 * var(--window-top, 0px) - 24px);
}
/* #endif */
</style>
