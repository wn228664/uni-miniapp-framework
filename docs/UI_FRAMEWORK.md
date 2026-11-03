# uView 接入与维护

采用 **uview-plus 3.8.138**，uView 的 Vue 3 / JavaScript 分支。上游源代码与 MIT 许可证已核对；没有把 Vue 2 的 uview-ui 2.x 安装到 Vue 3 工程。

官方来源：[仓库](https://github.com/ijry/uview-plus)、[NPM 接入文档](https://ijry.github.io/uview-plus/components/npmSetting.html)。

## 配置位置

- main.js：安装插件，配置 px 单位、原生主题同步，恢复偏好主题。px 保持宽屏控件的合理尺寸，布局本身使用流式宽度。
- uni.scss：只引入 theme.scss 变量；App.vue：只引入一次 index.scss，再引入项目布局。
- pages.json：easycom 的 up- 与库内 u- 前缀映射到 uview-plus/components；保持分包。
- manifest.json：微信 mergeVirtualHostAttributes=true。
- AppControl/AppSwitch：触控、状态、长标签与键盘语义；AppField：标量字段与选择器；其它包装器补真实的任务与错误边界。

没有把整个 UI 库复制到 src，也没有修改 node_modules。直接依赖固定版本，dayjs/clipboard 为上游 NPM 接入需要；它们不会取代已有的请求与会话封装。

## 按需构建

3.8.138 的 H5 入口默认 import.meta.glob eager 注册整库。工程已使用 easycom，因此 vite.config.js 的 framework:uview-easycom 在 H5 构建时只跳过该整库扫描，保留官方插件的工具、mixin 与主题初始化；微信编译不做此转换。

此适配器精确校验上游入口代码；库升级后匹配失败会明确终止构建，必须重新检查配置与两端构建。它不全局关闭警告或安全检查。当前 H5 产物没有被动打入未使用的 Lottie eval 模块。

## 字体与主题

H5 图标字体使用从该版本包中复制的 static/uview/upicon.ttf，旁边保留上游 LICENSE；开发预览无需字体 CDN。微信 uni.loadFontFace 按平台规则只支持 HTTPS 网络字体，因此微信保留官方字体源；真实弱网/离线字体行为需要目标端验收。不要把 H5 本地字体通过结果当成微信离线字体已通过。

依据：[uni.loadFontFace 平台说明](https://uniapp.dcloud.net.cn/api/ui/font.html)。

偏好 store 同时更新框架主题和 uView 运行时主题；自有正文、危险提示、主/次按钮有独立颜色约束。没有使用组件私有 DOM 或覆盖库内部任务状态。选择器工具栏命中高度通过公共样式扩展，事件接口保持上游协议。

## 升级检查

1. 核对 Vue/uni-app 兼容范围、上游变更、许可证与字体来源。
2. 检查 H5 eager 注册适配器的匹配位置，不能直接删除校验绕过失败。
3. 执行 npm ci、verify、响应式与交互矩阵，审查 lockfile/SBOM/audit。
4. 在微信工具与真机验证胶囊、输入、授权、图片与字体；确认后才发布新应用。
