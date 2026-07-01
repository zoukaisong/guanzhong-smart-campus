// pages/tag/submit/index.js — 统一标签提交
const { tagAPI, studentAPI } = require('../../../utils/request')
const { canSubmitTag } = require('../../../utils/auth')

Page({
  data: {
    step: 'select_student',
    studentKeyword: '',
    studentList: [],
    selectedStudent: null,
    tagGroups: [],
    selectedTags: [],
    tagDescription: '',
    tagPhotos: [],
    submitting: false
  },

  onLoad(options) {
    if (options.studentId) {
      this.loadStudentAndProceed(options.studentId)
    }
  },

  onShow() {
    if (!canSubmitTag()) {
      wx.showToast({ title: '您没有提交标签的权限', icon: 'none' })
      return
    }
    if (this.data.step === 'select_tags' && !this.data.selectedStudent) {
      this.loadTags()
    }
  },

  async loadStudentAndProceed(studentId) {
    var res = await studentAPI('detail', { studentId: studentId })
    if (res.code === 0) {
      this.setData({ selectedStudent: res.data, step: 'select_tags' })
      this.loadTags()
    } else {
      wx.showToast({ title: '学生不存在', icon: 'none' })
    }
  },

  onSearchInput: function (e) {
    this.setData({ studentKeyword: e.detail.value })
  },

  async onSearchStudent() {
    var kw = this.data.studentKeyword.trim()
    if (!kw) return

    var res = await studentAPI('list', { keyword: kw, page: 1, pageSize: 20 })
    if (res.code === 0) {
      this.setData({ studentList: res.data.list })
    }
  },

  onSelectStudent: function (e) {
    var student = e.detail.student
    this.setData({ selectedStudent: student, step: 'select_tags' })
    this.loadTags()
  },

  async loadTags() {
    var res = await tagAPI('configList', {}, { silent: true })
    if (res.code === 0) {
      var tags = res.data.filter(function (t) { return t.is_enabled })
      var groups = {}
      tags.forEach(function (t) {
        var g = t.group || '其他'
        if (!groups[g]) groups[g] = []
        groups[g].push(t)
      })
      var tagGroups = Object.entries(groups).map(function (entry) {
        return { group: entry[0], items: entry[1] }
      })
      this.setData({ tagGroups: tagGroups })
    }
  },

  onToggleTag: function (e) {
    var name = e.currentTarget.dataset.name
    var selected = this.data.selectedTags.concat()
    var idx = selected.indexOf(name)
    if (idx > -1) {
      selected.splice(idx, 1)
    } else {
      selected.push(name)
    }
    this.setData({ selectedTags: selected })
  },

  onDescInput: function (e) {
    this.setData({ tagDescription: e.detail.value })
  },

  onAddPhoto: function () {
    var remaining = 3 - this.data.tagPhotos.length
    if (remaining <= 0) return

    var that = this
    wx.chooseImage({
      count: remaining,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: function (res) {
        that.uploadPhotos(res.tempFilePaths)
      }
    })
  },

  async uploadPhotos(tempPaths) {
    wx.showLoading({ title: '上传中...', mask: true })
    var uploaded = []

    for (var i = 0; i < tempPaths.length; i++) {
      try {
        var cloudPath = 'tag_photos/' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '.jpg'
        var result = await wx.cloud.uploadFile({
          cloudPath: cloudPath,
          filePath: tempPaths[i]
        })
        uploaded.push(result.fileID)
      } catch (err) {
        console.error('图片上传失败:', err)
      }
    }

    wx.hideLoading()
    this.setData({ tagPhotos: this.data.tagPhotos.concat(uploaded) })
    if (uploaded.length < tempPaths.length) {
      wx.showToast({ title: '部分图片上传失败', icon: 'none' })
    }
  },

  onDeletePhoto: function (e) {
    var index = e.currentTarget.dataset.index
    var photos = this.data.tagPhotos.concat()
    photos.splice(index, 1)
    this.setData({ tagPhotos: photos })
  },

  onConfirmSubmit: function () {
    if (this.data.selectedTags.length === 0) {
      wx.showToast({ title: '请至少选择一个标签', icon: 'none' })
      return
    }
    this.setData({ step: 'confirm' })
  },

  async onSubmit() {
    if (this.data.submitting) return
    this.setData({ submitting: true })

    var res = await tagAPI('submit', {
      studentId: this.data.selectedStudent._id,
      tagNames: this.data.selectedTags,
      description: this.data.tagDescription.trim(),
      photos: this.data.tagPhotos
    }, { showLoading: true })

    this.setData({ submitting: false })

    if (res.code === 0) {
      var addedTags = res.data.addedTags
      var skippedTags = res.data.skippedTags
      var classification = res.data.classification

      var msg = '成功添加 ' + addedTags.length + ' 个标签'
      if (skippedTags && skippedTags.length > 0) {
        msg += '，' + skippedTags.length + ' 个已存在'
      }

      var parts = []
      if (classification.six.length > 0) parts.push('六类: ' + classification.six.join('、'))
      if (classification.four.length > 0) parts.push('四特: ' + classification.four.join('、'))
      if (classification.out_of_school.length > 0) parts.push('在籍不在校: ' + classification.out_of_school.join('、'))

      var that = this
      wx.showModal({
        title: '提交成功',
        content: msg + '\n\n自动归类:\n' + parts.join('\n'),
        showCancel: false,
        success: function () {
          that.setData({
            step: 'select_student',
            selectedStudent: null,
            selectedTags: [],
            tagDescription: '',
            tagPhotos: [],
            studentKeyword: '',
            studentList: []
          })
        }
      })
    }
  },

  onBackToStudent: function () {
    this.setData({
      step: 'select_student',
      selectedStudent: null,
      selectedTags: [],
      tagDescription: '',
      tagPhotos: [],
      studentKeyword: '',
      studentList: []
    })
  },

  onBackToTags: function () {
    this.setData({ step: 'select_tags' })
  }
})
