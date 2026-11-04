/** 构建期配置可被客户端读取，不能放密钥；空 API 地址允许启动，实际请求时再明确拒绝。 */
// config：冻结的公开配置：title 默认 Miniapp Framework，apiBaseUrl 默认空；空基址允许首页启动，发请求时明确拒绝。
export const config = Object.freeze({
  title: import.meta.env.VITE_APP_TITLE || 'Miniapp Framework',
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '',
})
