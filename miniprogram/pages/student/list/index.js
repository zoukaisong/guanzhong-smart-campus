// pages/student/list/index.js — 学生列表
var req = require('../../../utils/request')
var studentAPI = req.studentAPI
var constants = require('../../../utils/constants')
var SIX_CATEGORIES = constants.SIX_CATEGORIES
var FOUR_SPECIAL_CATEGORIES = constants.FOUR_SPECIAL_CATEGORIES
var OUT_OF_SCHOOL_CATEGORIES = constants.OUT_OF_SCHOOL_CATEGORIES
var auth = require('../../../utils/auth')
var isLoggedIn = auth.isLoggedIn

Page({
  data: {
    activeTab: 'all',
    sixCategories: Object.values(SIX_CATEGORIES),
    selectedSix: '',
    fourCategories: Object.values(FOUR_SPECIAL_CATEGORIES),
    selectedFour: '',
    outCategories: Object.values(OUT_OF_SCHOOL_CATEGORIES),
    selectedOut: '',
    studentList: [],
    total: 0,
    page: 1,
    pageSize: 20,
    isLoading: false,
    hasMore: true,
    keyword: ''
  },

  onShow: function () {
    if (!isLoggedIn()) {
      wx.redirectTo({ url: '/pages/login/index' })
      return
    }
    this.setData({ page: 1, studentList: [], hasMore: true })
    this.loadStudents()
  },

  onPullDownRefresh: function () {
    this.setData({ page: 1, studentList: [], hasMore: true })
    var that = this
    this.loadStudents().finally(function () { wx.stopPullDownRefresh() })
  },

  onReachBottom: function () {
    this.loadStudents()
  },

  onTapTab: function (e) {
    var tab = e.currentTarget.dataset.tab
    this.setData({
      activeTab: tab, page: 1, studentList: [], hasMore: true,
      selectedSix: '', selectedFour: '', selectedOut: ''
    })
    this.loadStudents()
  },

  onSelectSix: function (e) {
    this.setData({ selectedSix: e.currentTarget.dataset.cat, page: 1, studentList: [], hasMore: true })
    this.loadStudents()
  },
  onSelectFour: function (e) {
    this.setData({ selectedFour: e.currentTarget.dataset.cat, page: 1, studentList: [], hasMore: true })
    this.loadStudents()
  },
  onSelectOut: function (e) {
    this.setData({ selectedOut: e.currentTarget.dataset.cat, page: 1, studentList: [], hasMore: true })
    this.loadStudents()
  },

  onSearchInput: function (e) {
    this.setData({ keyword: e.detail.value })
  },
  onSearch: function () {
    this.setData({ page: 1, studentList: [], hasMore: true })
    this.loadStudents()
  },

  loadStudents: async function () {
    if (this.data.isLoading || !this.data.hasMore) return
    this.setData({ isLoading: true })

    var res
    var activeTab = this.data.activeTab
    var page = this.data.page
    var pageSize = this.data.pageSize
    var keyword = this.data.keyword
    var selectedSix = this.data.selectedSix
    var selectedFour = this.data.selectedFour
    var selectedOut = this.data.selectedOut

    try {
      if (activeTab === 'all') {
        res = await studentAPI('list', { page: page, pageSize: pageSize, keyword: keyword || undefined })
      } else if (activeTab === 'six') {
        res = await studentAPI('listByCategory', {
          page: page, pageSize: pageSize, system: 'six',
          category: selectedSix || undefined, keyword: keyword || undefined
        })
      } else if (activeTab === 'four') {
        res = await studentAPI('listByCategory', {
          page: page, pageSize: pageSize, system: 'four',
          category: selectedFour || undefined, keyword: keyword || undefined
        })
      } else if (activeTab === 'out_of_school') {
        res = await studentAPI('listOutOfSchool', {
          page: page, pageSize: pageSize,
          category: selectedOut || undefined, keyword: keyword || undefined
        })
      }

      if (res && res.code === 0) {
        var list = res.data.list
        var total = res.data.total
        var curPage = res.data.page
        var ps = res.data.pageSize
        this.setData({
          studentList: this.data.studentList.concat(list),
          total: total,
          page: curPage + 1,
          hasMore: curPage * ps < total
        })
      }
    } finally {
      this.setData({ isLoading: false })
    }
  },

  onTapStudent: function (e) {
    var student = e.detail.student
    wx.navigateTo({ url: '/pages/student/detail/index?studentId=' + student._id })
  }
})
