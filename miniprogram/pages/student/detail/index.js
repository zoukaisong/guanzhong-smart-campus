// pages/student/detail/index.js — 学生详情
var studentAPI = require('../../../utils/request').studentAPI

Page({
  data: {
    studentId: '',
    student: null,
    loading: true
  },

  onLoad: function (options) {
    if (options.studentId) {
      this.setData({ studentId: options.studentId })
      this.loadDetail()
    }
  },

  onShow: function () {
    if (this.data.studentId) {
      this.loadDetail()
    }
  },

  loadDetail: async function () {
    this.setData({ loading: true })
    var res = await studentAPI('detail', { studentId: this.data.studentId })
    if (res.code === 0) {
      this.setData({ student: res.data, loading: false })
    } else {
      wx.showToast({ title: res.message, icon: 'none' })
      this.setData({ loading: false })
    }
  },

  onTapAddRecord: function () {
    wx.showToast({ title: '记录功能开发中', icon: 'none' })
  },

  onTapAddTag: function () {
    var studentId = this.data.studentId
    wx.navigateTo({ url: '/pages/tag/submit/index?studentId=' + studentId })
  }
})
