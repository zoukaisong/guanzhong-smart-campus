// pages/mine/index.js — 我的
const { getCurrentUser } = require('../../utils/auth')
const { ROLE_LABELS } = require('../../utils/constants')

Page({
  data: {
    user: null
  },

  onShow() {
    this.setData({ user: getCurrentUser() })
  },

  onTapEditProfile() {
    wx.showToast({ title: '个人信息修改功能开发中', icon: 'none' })
  },

  onTapAbout() {
    wx.showModal({
      title: '关中智慧校园',
      content: '版本 1.0.0\n特殊学生群体管理系统\n关口中学',
      showCancel: false
    })
  }
})
