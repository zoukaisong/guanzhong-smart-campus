// app.js — 关中智慧校园 小程序入口
const { USER_ROLES } = require('./utils/constants')

App({
  onLaunch() {
    // 初始化云开发
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
      return
    }

    wx.cloud.init({
      env: 'cloudbase-d4glzztw6048b36b4',
      traceUser: true
    })

    this.checkLoginStatus()
  },

  // ========== 全局数据 ==========
  globalData: {
    // 当前用户信息（登录后填充）
    user: null,
    // 是否已登录
    isLoggedIn: false,
    // 当前学期
    currentSemester: null,
    // 学期配置
    semesterConfig: null
  },

  // ========== 登录状态检查 ==========
  async checkLoginStatus() {
    const user = wx.getStorageSync('user')
    if (user && user.status === 'approved') {
      this.globalData.user = user
      this.globalData.isLoggedIn = true
    }
  },

  // ========== 设置用户信息 ==========
  setUser(user) {
    this.globalData.user = user
    this.globalData.isLoggedIn = true
    wx.setStorageSync('user', user)
  },

  // ========== 清除登录状态 ==========
  clearUser() {
    this.globalData.user = null
    this.globalData.isLoggedIn = false
    wx.removeStorageSync('user')
  },

  // ========== 权限检查 ==========
  hasRole(...roles) {
    const user = this.globalData.user
    if (!user) return false
    return roles.includes(user.role)
  },

  isAdmin() {
    return this.globalData.user?.role === USER_ROLES.ADMIN
  },

  isPrincipal() {
    const role = this.globalData.user?.role
    return role === USER_ROLES.PRINCIPAL || role === USER_ROLES.VICE_PRINCIPAL
  },

  isDirector() {
    const role = this.globalData.user?.role
    return role === USER_ROLES.DIRECTOR || role === USER_ROLES.VICE_DIRECTOR
  },

  isClassTeacher() {
    return this.globalData.user?.role === USER_ROLES.CLASS_TEACHER
  }
})
