// pages/student/list/index.js — 学生列表（含六类/四特/在籍不在校筛选）
const { studentAPI } = require('../../../utils/request')
const { SIX_CATEGORIES, FOUR_SPECIAL_CATEGORIES, OUT_OF_SCHOOL_CATEGORIES } = require('../../../utils/constants')
const { isLoggedIn } = require('../../../utils/auth')

Page({
  data: {
    // 当前视图
    activeTab: 'all',       // all | six | four | out_of_school
    // 六类子类别
    sixCategories: Object.values(SIX_CATEGORIES),
    selectedSix: '',
    // 四特子类别
    fourCategories: Object.values(FOUR_SPECIAL_CATEGORIES),
    selectedFour: '',
    // 在籍不在校子类别
    outCategories: Object.values(OUT_OF_SCHOOL_CATEGORIES),
    selectedOut: '',

    // 列表
    studentList: [],
    total: 0,
    page: 1,
    pageSize: 20,
    isLoading: false,
    hasMore: true,
    keyword: ''
  },

  onShow() {
    if (!isLoggedIn()) {
      wx.redirectTo({ url: '/pages/login/index' })
      return
    }
    this.setData({ page: 1, studentList: [], hasMore: true })
    this.loadStudents()
  },

  onPullDownRefresh() {
    this.setData({ page: 1, studentList: [], hasMore: true })
    this.loadStudents().finally(() => wx.stopPullDownRefresh())
  },

  onReachBottom() {
    this.loadStudents()
  },

  // ==================== Tab 切换 ====================
  onTapTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({
      activeTab: tab,
      page: 1,
      studentList: [],
      hasMore: true,
      selectedSix: '',
      selectedFour: '',
      selectedOut: ''
    })
    this.loadStudents()
  },

  onSelectSix(e) {
    this.setData({ selectedSix: e.currentTarget.dataset.cat, page: 1, studentList: [], hasMore: true })
    this.loadStudents()
  },
  onSelectFour(e) {
    this.setData({ selectedFour: e.currentTarget.dataset.cat, page: 1, studentList: [], hasMore: true })
    this.loadStudents()
  },
  onSelectOut(e) {
    this.setData({ selectedOut: e.currentTarget.dataset.cat, page: 1, studentList: [], hasMore: true })
    this.loadStudents()
  },

  // ==================== 搜索 ====================
  onSearchInput(e) {
    this.setData({ keyword: e.detail.value })
  },
  onSearch() {
    this.setData({ page: 1, studentList: [], hasMore: true })
    this.loadStudents()
  },

  // ==================== 加载数据 ====================
  async loadStudents() {
    if (this.data.isLoading || !this.data.hasMore) return
    this.setData({ isLoading: true })

    let res
    const { activeTab, page, pageSize, keyword, selectedSix, selectedFour, selectedOut } = this.data

    try {
      if (activeTab === 'all') {
        res = await studentAPI('list', { page, pageSize, keyword: keyword || undefined })
      } else if (activeTab === 'six') {
        res = await studentAPI('listByCategory', {
          page, pageSize, system: 'six',
          category: selectedSix || undefined,
          keyword: keyword || undefined
        })
      } else if (activeTab === 'four') {
        res = await studentAPI('listByCategory', {
          page, pageSize, system: 'four',
          category: selectedFour || undefined,
          keyword: keyword || undefined
        })
      } else if (activeTab === 'out_of_school') {
        res = await studentAPI('listOutOfSchool', {
          page, pageSize,
          category: selectedOut || undefined,
          keyword: keyword || undefined
        })
      }

      if (res && res.code === 0) {
        const { list, total, page: curPage, pageSize: ps } = res.data
        this.setData({
          studentList: this.data.studentList.concat(list),
          total,
          page: curPage + 1,
          hasMore: curPage * ps < total
        })
      }
    } finally {
      this.setData({ isLoading: false })
    }
  },

  // ==================== 点击学生 ====================
  onTapStudent(e) {
    const { student } = e.detail
    wx.navigateTo({ url: `/pages/student/detail/index?studentId=${student._id}` })
  }
})
