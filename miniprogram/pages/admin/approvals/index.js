// pages/admin/approvals/index.js — 用户审核（管理员）
const { authAPI } = require('../../../utils/request')
const { isAdmin } = require('../../../utils/auth')
const { formatDate } = require('../../../utils/date')

Page({
  data: {
    isAdmin: false,
    pendingList: [],
    total: 0,
    page: 1,
    pageSize: 20,
    loading: true,
    hasMore: true
  },

  onShow() {
    if (!isAdmin()) {
      wx.showToast({ title: '仅管理员可访问', icon: 'none' })
      return
    }
    this.setData({ isAdmin: true, page: 1, pendingList: [], hasMore: true, loading: false })
    this.loadList()
  },

  onReachBottom() {
    this.loadList()
  },

  async loadList() {
    if (!this.data.hasMore || this.data.loading) return
    this.setData({ loading: true })

    const res = await authAPI('pendingList', { page: this.data.page, pageSize: this.data.pageSize })

    if (res.code === 0) {
      const { list, total, page, pageSize } = res.data
      const formattedList = list.map(item => ({
        ...item,
        create_time_display: formatDate(item.create_time, 'datetime')
      }))
      this.setData({
        pendingList: this.data.pendingList.concat(formattedList),
        total,
        page: page + 1,
        hasMore: page * pageSize < total,
        loading: false
      })
    } else {
      this.setData({ loading: false })
      wx.showToast({ title: res.message || '加载失败', icon: 'none' })
    }
  },

  async onApprove(e) {
    const { userId } = e.currentTarget.dataset
    wx.showModal({
      title: '确认审核通过？',
      content: '通过后该用户即可登录使用',
      success: async (modalRes) => {
        if (modalRes.confirm) {
          const res = await authAPI('approve', { userId }, { showLoading: true })
          if (res.code === 0) {
            wx.showToast({ title: '审核通过', icon: 'success' })
            this.setData({ page: 1, pendingList: [], hasMore: true })
            this.loadList()
          }
        }
      }
    })
  },

  async onReject(e) {
    const { userId } = e.currentTarget.dataset
    wx.showModal({
      title: '确认拒绝？',
      editable: true,
      placeholderText: '请输入拒绝原因',
      success: async (modalRes) => {
        if (modalRes.confirm) {
          const res = await authAPI('reject', { userId, reason: modalRes.content || '' }, { showLoading: true })
          if (res.code === 0) {
            wx.showToast({ title: '已拒绝', icon: 'success' })
            this.setData({ page: 1, pendingList: [], hasMore: true })
            this.loadList()
          }
        }
      }
    })
  }
})
