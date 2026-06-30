// pages/student/detail/index.js — 学生详情
const { studentAPI } = require('../../../utils/request')
const { OUT_OF_SCHOOL_STATUS_LABELS } = require('../../../utils/constants')

Page({
  data: {
    studentId: '',
    student: null,
    loading: true,
    activeSection: 'basic'   // basic | tags | outOfSchool
  },

  onLoad(options) {
    if (options.studentId) {
      this.setData({ studentId: options.studentId })
      this.loadDetail()
    }
  },

  onShow() {
    if (this.data.studentId) {
      this.loadDetail()
    }
  },

  async loadDetail() {
    this.setData({ loading: true })
    const res = await studentAPI('detail', { studentId: this.data.studentId })
    if (res.code === 0) {
      this.setData({ student: res.data, loading: false })
    } else {
      wx.showToast({ title: res.message, icon: 'none' })
      this.setData({ loading: false })
    }
  },

  onTapSection(e) {
    const section = e.currentTarget.dataset.section
    this.setData({ activeSection: section })
  },

  // 获取六类归类
  getSixCategories() {
    const tags = this.data.student?.tags || []
    const cats = new Set(tags.filter(t => t.category_6).map(t => t.category_6))
    return [...cats]
  },

  // 获取四特归类
  getFourCategories() {
    const tags = this.data.student?.tags || []
    const cats = new Set(tags.filter(t => t.category_4).map(t => t.category_4))
    return [...cats]
  },

  // 获取在籍不在校归类
  getOutCategories() {
    const tags = this.data.student?.tags || []
    const cats = new Set(tags.filter(t => t.category_out).map(t => t.category_out))
    return [...cats]
  }
})
