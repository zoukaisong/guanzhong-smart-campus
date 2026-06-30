// utils/auth.js — 前端鉴权工具

const { USER_ROLES } = require('./constants')

/**
 * 获取当前用户（从 globalData 或 storage）
 */
function getCurrentUser() {
  const app = getApp()
  if (app.globalData.user) return app.globalData.user

  const cached = wx.getStorageSync('user')
  if (cached && cached.status === 'approved') {
    app.globalData.user = cached
    app.globalData.isLoggedIn = true
    return cached
  }
  return null
}

/**
 * 检查是否已登录且审核通过
 */
function isLoggedIn() {
  return !!getCurrentUser()
}

/**
 * 检查当前用户是否拥有指定角色之一
 * @param {...string} roles - 允许的角色列表
 */
function hasRole(...roles) {
  const user = getCurrentUser()
  if (!user) return false
  return roles.includes(user.role)
}

/**
 * 检查是否为管理员
 */
function isAdmin() {
  return hasRole(USER_ROLES.ADMIN)
}

/**
 * 检查是否为校长/副校长级别
 */
function isPrincipal() {
  return hasRole(USER_ROLES.PRINCIPAL, USER_ROLES.VICE_PRINCIPAL)
}

/**
 * 检查是否为德育处主任/副主任
 */
function isDirector() {
  return hasRole(USER_ROLES.DIRECTOR, USER_ROLES.VICE_DIRECTOR)
}

/**
 * 检查是否为班主任
 */
function isClassTeacher() {
  return hasRole(USER_ROLES.CLASS_TEACHER)
}

/**
 * 检查是否为心理老师
 */
function isPsychologyTeacher() {
  return hasRole(USER_ROLES.PSYCHOLOGY_TEACHER)
}

/**
 * 检查是否为教官
 */
function isInstructor() {
  return hasRole(USER_ROLES.INSTRUCTOR)
}

/**
 * 检查是否为安全办成员
 */
function isSafetyMember() {
  return hasRole(USER_ROLES.SAFETY_MEMBER)
}

/**
 * 检查是否为安全办主任
 */
function isSafetyHead() {
  return hasRole(USER_ROLES.SAFETY_HEAD)
}

/**
 * 检查是否有数据导出权限
 */
function canExport() {
  return hasRole(
    USER_ROLES.ADMIN,
    USER_ROLES.PRINCIPAL,
    USER_ROLES.VICE_PRINCIPAL,
    USER_ROLES.DIRECTOR,
    USER_ROLES.VICE_DIRECTOR,
    USER_ROLES.SAFETY_HEAD
  )
}

/**
 * 检查是否可以提交违纪记录
 */
function canSubmitDiscipline() {
  return hasRole(
    USER_ROLES.ADMIN,
    USER_ROLES.DIRECTOR,
    USER_ROLES.VICE_DIRECTOR,
    USER_ROLES.CLASS_TEACHER,
    USER_ROLES.INSTRUCTOR
  )
}

/**
 * 检查是否可以提交标签
 */
function canSubmitTag() {
  return hasRole(
    USER_ROLES.ADMIN,
    USER_ROLES.DIRECTOR,
    USER_ROLES.VICE_DIRECTOR,
    USER_ROLES.CLASS_TEACHER
  )
}

/**
 * 跳转到登录页（未登录时调用）
 */
function redirectToLogin() {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  if (currentPage && currentPage.route !== 'pages/login/index') {
    wx.redirectTo({ url: '/pages/login/index' })
  }
}

module.exports = {
  getCurrentUser,
  isLoggedIn,
  hasRole,
  isAdmin,
  isPrincipal,
  isDirector,
  isClassTeacher,
  isPsychologyTeacher,
  isInstructor,
  isSafetyMember,
  isSafetyHead,
  canExport,
  canSubmitDiscipline,
  canSubmitTag,
  redirectToLogin
}
