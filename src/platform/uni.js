// 显式引用平台 API，保证 uni-app 的按需编译能够收集到依赖；测试层注入同形状适配器。
export const platform = {
  chooseImage: uni.chooseImage,
  compressImage: uni.compressImage,
  showToast: uni.showToast,
  showLoading: uni.showLoading,
  hideLoading: uni.hideLoading,
  request: uni.request,
  uploadFile: uni.uploadFile,
  navigateTo: uni.navigateTo,
  redirectTo: uni.redirectTo,
  switchTab: uni.switchTab,
  navigateBack: uni.navigateBack,
  getStorageSync: uni.getStorageSync,
  setStorageSync: uni.setStorageSync,
  removeStorageSync: uni.removeStorageSync,
}
