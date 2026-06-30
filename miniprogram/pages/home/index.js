// pages/home/index.js — 首页看板
const { tagAPI } = require('../../utils/request')
const { isLoggedIn, getCurrentUser } = require('../../utils/auth')

Page({
  data: {
    user: null,
    stats: { six: {}, four: {}, outOfSchool: {} },
    loading: true,
    // 快捷入口
    quickEntries: []
  },

  onShow() {
    if (!isLoggedIn()) {
      wx.redirectTo({ url: '/pages/login/index' })
      return
    }

    const user = getCurrentUser()
    this.setData({ user, quickEntries: this.buildQuickEntries(user) })
    this.loadStats()
  },

  buildQuickEntries(user) {
    const role = user.role
    const entries = [
      { title: '学生列表', icon: '👨‍🎓', url: '/pages/student/list/index', roles: '*' },
      { title: '六类学生', icon: '📊', url: '/pages/student/list/index?tab=six', roles: '*' },
      { title: '四特学生', icon: '🌟', url: '/pages/student/list/index?tab=four', roles: '*' },
      { title: '在籍不在校', icon: '🏠', url: '/pages/student/list/index?tab=out', roles: '*' },
      { title: '提交标签', icon: '🏷️', url: '/pages/tag/submit/index', roles: ['admin', 'director', 'vice_director', 'class_teacher'] },
      { title: '用户审核', icon: '✅', url: '/pages/admin/approvals/index', roles: ['admin'] },
      { title: '系统设置', icon: '⚙️', url: '/pages/admin/settings/index', roles: ['admin'] }
    ]

    return entries.filter(e => e.roles === '*' || e.roles.includes(role))
  },

  async loadStats() {
    try {
      const res = await tagAPI('categoryStats', {}, { silent: true })
      if (res.code === 0) {
        this.setData({ stats: res.data, loading: false })
      } else {
        this.setData({ loading: false })
      }
    } catch {
      this.setData({ loading: false })
    }
  },

  onTapEntry(e) {
    const { url } = e.currentTarget.dataset
    if (url.startsWith('/pages/admin/') || url.startsWith('/pages/tag/')) {
      wx.navigateTo({ url })
    } else {
      wx.switchTab({ url })
    }
  }
})
