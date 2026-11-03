# 依赖来源与兼容边界

基础：DCloud 官方 uni-preset-vue 的 vite 分支，读取时 commit `f42e736569c0c51ceb13a69d2a2122b382fbe9f1`。模板的 JavaScript 代码和配置已按通用框架重新组织，未保留上游 Git 远端或历史。

DCloud 编译器系列统一固定 `3.0.0-5030420261029002`。该版本 peer 要求 Vite **5.2.8**；第一次尝试 5.4.21 因 peer 不兼容已停止，未使用 --force 或 --legacy-peer-deps。Vue / runtime-core 为 3.4.21，Pinia 2.1.7，uview-plus 3.8.138、dayjs 1.11.13、clipboard 2.0.11；没有根据当前 Vue 新文档使用 3.5 专属 API。

原有依赖保留 registry.npmmirror.com 的锁定地址；该镜像尚无 uview-plus 3.8.138，新增 UI 依赖从 registry.npmjs.org 安装。版本/下载地址/integrity 以 package-lock.json 为准，未重写其它包的来源。Node 22.21.1 / npm 10.9.4；npm ci 恢复依赖。UI 使用 easycom 按需引入，未附带整套第三方业务 SDK。

兼容修补：source-map-js 覆盖到 1.2.2，ws 覆盖到 8.21.0，分别处理审计提示的 source-map 与 WebSocket 问题。补丁后干净锁文件安装、lint、测试与两种构建已通过。

npm audit 已真实执行，并发现官方依赖链仍有告警，特别是 Vite 开发服务器、编译辅助包以及国际化依赖。模板编译器有精确版本约束，未擅自跨主版本替换整个工具链。初始审计 60 项告警；修补后官方 registry.npmjs.org 审计 51 项（22 high / 19 moderate / 10 low / 0 critical）。npm 镜像不支持审计接口，因此审计请求单独使用官方 registry。当前不能声称依赖安全扫描全部通过。

开发服务器绑定 127.0.0.1，H5 用于本机预览；默认没有不可信远程模板、动态翻译内容或远程编译输入。此设置不等于修复全部依赖告警。作为生产新项目使用前需结合目标平台与服务输入进一步审查并跟进官方编译器更新。

许可元数据：Vue / Pinia / Vite 为 MIT；DCloud 编译器为 Apache-2.0，uview-plus / dayjs / clipboard 为 MIT。各依赖许可证以已安装包与上游为准；本记录不是全面许可审计。没有对全部依赖做签名/provenance 验证，锁文件与来源记录仅提供版本可复现证据。


本次 UI 替换新增7个锁定包、移除1个 uni-ui 包；新增包没有 install script，版本和 integrity 已核对。干净离线安装通过，锁文件未变。审计兼容修复 dry-run 没有计划版本变更，仍为51项；未执行强制升级或将可选平台二进制清单当成漏洞修复。供应链签名和 attestation 的实际结果见验证记录。
