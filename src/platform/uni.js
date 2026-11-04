// 显式引用平台 API，保证 uni-app 的按需编译能够收集到依赖；测试层注入同形状适配器。
// platform：显式引用所有用到的 uni 平台方法，保证编译器收集依赖；核心服务测试注入同形替身，不使用隐式全局遍历。
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
