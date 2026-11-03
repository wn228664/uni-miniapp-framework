# 通用封装使用指南

## 任务与生命周期

createOperation(start, { token, timeoutMs }) 返回 `{ promise, cancel }`。start 接收 resolve / reject，返回底层中止函数；取消、超时和完成只交付一次。取消先结束 Promise 再中止平台 Task，避免平台 fail 回调覆盖原取消原因。调用者须处理 Promise 拒绝。

createCancellation() 提供 subscribe / cancel / cancelled / reason，不依赖浏览器 AbortController。超时使用毫秒正数。取消不等于服务端副作用撤销。

createAction(state) 提供 run / cancel / dispose；run(execute) 将 token 传给 execute，同步拒绝重复进入（BUSY）。旧周期 finally 不更新新周期；UI 通过 reactive(state) 观察。dispose 后不可启动新任务。错误保留在 state.error，取消不显示失败。

usePageTasks(...owners) 由页面调用：onHide 取消前台任务，onUnload / scope 销毁释放 owner。需要后台继续的上传不能绑定到会被隐藏销毁的页面 owner，应另建应用级 owner。组件自身 onScopeDispose 不能代替页面隐藏清理。

## 网络与上传

createHttp 接收 platform / baseUrl / session / timeoutMs。request(path, options) 只接受以 / 开头的相对路径，不允许协议相对地址或覆盖服务地址。基地址不能包含凭证、查询或片段；响应必须包含有效 HTTP 状态。默认读取当前 token，authenticated=false 不注入凭证或执行 401 清理。成功、失败响应都检查 revision；当前 401 清理会话，旧 401 不清除新登录。

请求返回原始 data；错误分类包括 API_NOT_CONFIGURED / INVALID_PATH / DECODE / HTTP / NETWORK / TIMEOUT / CANCELLED / STALE。业务失败必须由服务适配抛错。默认不缓存、不自动重试写操作。

createUpload 按文件保留 Task；进度在取消/完成时解绑，onProgress 为 0..100。必须提供 decode(responseBody)，输出非空 HTTP(S) URL。取消、移除、离页后不交付迟到进度或 URL。真实上传的服务端文件校验与权限由新应用验收。

## 存储、状态与导航

createStorage(platform, namespace, now) 的 get(key, fallback) 对损坏或不可读数据返回 fallback；set(key, value, ttlMs) 保存 JSON，TTL 单位毫秒，写失败抛 STORAGE。remove 只处理自己的 key。它不是系统安全存储，不保存服务端密钥。无法 JSON 序列化的值不属于持久化契约。

Pinia session 使用内存 token、字符串权限列表与 revision。偏好 store 保存成功后更新 theme；失败保留原偏好。退出真实账号时由服务 owner 清理该账号的缓存，不调用无范围的全局 clearStorage。

navigation.go(path, { query, replace }) 只允许注册路由；query 是字符串/数字/布尔标量；Tab 页面不接受 query。back 在页面栈只有一页时替换到后备入口。跳转并发拒绝 BUSY，平台失败或超时释放锁；无平台取消能力时迟到导航本身不能撤回。客户端守卫不能替代服务端鉴权。

## 列表与表单

createPagination 的 load({ page, pageSize, token }) 应返回 `{ items, hasMore }`；默认 keyOf 为 item.id，也可注入。失败不推进页码；next 防重复；refresh 清理旧任务并在新结果有效后替换列表；旧列表在失败时保留。不要让页码推断、total 或业务字段散落进组件。

AppList 只消费数据与状态，发出 more / refresh，插槽渲染每一项。itemKey 可为属性名（默认 id）或函数，必须与分页的 keyOf 一致。pageSize 必须为正整数。示例默认手动加载；需要无限滚动时显式打开 autoLoad，防止无意叠加入口。AppState 按 loading / error / empty / data 展示，不把错误当空数据。

AppForm 使用 v-model 对象，fields 每项包含 name / label / type / rules / placeholder / maxLength。type 支持普通输入、select（options 为 value/text）、date。普通输入支持 text / number / password；组件字段消费 string / number / boolean 标量。规则为同步 `(value, model) => 错误文本或空字符串`，异步校验应在提交服务中完成，返回 Promise 的规则会被拒绝。date 使用本地 YYYY-MM-DD；dateTimestamp 严格检查无效日期，dateInput 不经过 UTC。minDate/maxDate 为可选毫秒时间戳。submit(snapshot, token) 返回 Promise；失败保留所有字段。success 只在有效周期发出。字段传输格式由服务层决定，组件不内置业务字段。

AppButton 的必填 action(token) 承担异步工作，按钮同步占锁，done 只对当前成功周期发出。disabled / loading 可附加外部状态，不能替代服务端幂等。

## 弹窗与媒体

AppDialog 使用 v-model、title、必填 confirm(token) 和默认内容插槽。confirm 成功后关闭并发 confirmed，失败保留弹窗与错误；取消中止本周期。父页 onHide 应关闭受控弹窗。正文滚动与操作区分离；初始 model=true、关闭重开、销毁都有独立周期。

AppUpload 的 upload(filePath, { token, onProgress }) 返回上传后的 URL Promise；不传 upload 时只做本地选择预览。默认单图最大 10MB，compress 可启用平台压缩；文件限制仍以最终结果和服务端要求为准。暴露 cancel / clear，clear 同时取消任务、复位进度和回填空值。选择器由系统控制，取消无法强制关闭它时只停止消费迟到选择。

media.chooseImage / compressImage 均返回任务句柄。压缩质量为 0..100 的整数，不支持时明确返回错误，不伪装压缩成功。AppImage 对无图/失败提供可读占位。

feedback.withLoading(title, execute) 应等待完整任务；多个 owner 并行时最后一个结束才 hideLoading。toast 输出普通文本。不得让永不 settle 的外部 Promise 占住全局遮罩；与 createAction / operation 的取消超时组合使用。

## 布局、平台与工具

AppPage 管理页面宽度、主题、底部安全区、网络提示；网络连接不代表服务端可达。AppNavbar 用于声明自定义导航的页面，避免与原生导航重复；胶囊指标在目标平台验证。局部 scroll-view 需明确高度，页面与组件不要争抢同一滚动事件。

platform/uni.js 必须显式引用 API，避免按需编译遗漏动态 API。测试通过相同边界注入适配器，不使用默认成功的假平台实现。

工具函数提供 isBlank / encodeQuery / formatDate / dateInput / dateTimestamp / formatNumber / formatBytes / validateFields / required / debounce / throttle。0 和 false 不被视为空；日期为当前运行时 locale 的日期格式；formatNumber 是展示格式化，不能替代高精度运算；throttle 为前沿执行，无排队尾调用，debounce 提供 cancel。按新业务需要扩展，不做无使用点的镜像封装。

## uView 控件与交互约定

AppControl 封装 up-button 的视觉与可操作语义，接收 label / secondary / disabled / loading，发出 activate；它只负责入口，不拥有业务任务。普通按钮最小外框高度46px，长标签自然换行，loading 保留标签。Enter / Space 与点击共用入口，不可用状态不触发。AppButton 在它外面持有 createAction，承担异步任务的锁与失败恢复。

AppSwitch 接收 modelValue / label / disabled / loading，发出 update:modelValue。它扩大轨道之外的命中区域，支持键盘与读屏状态；它不替父组件持久化状态。持久化失败由父组件保留旧值并提示。

AppField 是 AppForm 的字段视图，使用 up-input / up-picker / up-datetime-picker。普通输入 Enter 发出 confirm；选择、取消和父级 cancel 都有明确入口。AppForm 暴露的 cancel 同时关闭字段选择层。

AppDialog 在 H5 打开后移动焦点到弹窗，Tab/Shift+Tab 在弹窗内循环，Esc 等同取消，关闭后恢复触发入口焦点；这不等于微信端读屏已验证。AppDialog 基于受控 up-popup，关闭即卸载局部内容，duration=0 避免旧过渡回调影响新周期。长期表单数据保存在父组件；正文是可收缩 scroll-view，标题与操作区不随正文滚动。短屏使用最大高度约束，H5 额外避开导航栏高度。

AppNavbar 基于 up-navbar；页面必须显式设置 navigationStyle=custom。fixed 模式生成占位，返回按钮走共享导航锁；只展示标题的布局可不启用 back。胶囊、原生安全区和软键盘必须在微信环境核验。

主题在偏好 store 与 uni.$u.setThemePreference 之间同步。使用服务层 request/upload/navigation，避免同时启用库内另一套鉴权、请求或跳转约定。uview-plus 的纯格式化/校验工具可按需使用；具有状态或副作用的工具应明确 owner，不与现有封装重复管理任务。
