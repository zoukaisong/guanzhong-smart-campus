// pages/student/import/index.js — Excel 批量导入（占位，核心功能后续开发）
const { studentAPI } = require('../../../utils/request')

Page({
  data: {
    file: null,
    fileName: '',
    importing: false,
    result: null
  },

  onChooseFile() {
    wx.showToast({ title: 'Excel 导入功能开发中', icon: 'none' })
    // TODO: 实现 wx.chooseMessageFile 选择 .xlsx，云函数解析
  },

  async onStartImport() {
    wx.showToast({ title: '导入功能开发中', icon: 'none' })
  }
})
