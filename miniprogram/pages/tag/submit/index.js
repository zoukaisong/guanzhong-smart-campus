// pages/tag/submit/index.js — 统一标签提交
const { tagAPI, studentAPI } = require('../../../utils/request')
const { canSubmitTag } = require('../../../utils/auth')

Page({
  data: {
    // 步骤: select_student | select_tags | confirm
    step: 'select_student',

    // 学生搜索
    studentKeyword: '',
    studentList: [],
    selectedStudent: null,

    // 标签列表（从 config_tags 加载）
    tagGroups: [],
    selectedTags: [],
    tagDescription: '',

    submitting: false
  },

  onLoad(options) {
    // 从学生详情页带入 studentId，直接跳到选标签
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
    const res = await studentAPI('detail', { studentId })
    if (res.code === 0) {
      this.setData({ selectedStudent: res.data, step: 'select_tags' })
      this.loadTags()
    } else {
      wx.showToast({ title: '学生不存在', icon: 'none' })
    }
  },
  },

  // ==================== Step 1: 搜索学生 ====================
  onSearchInput(e) {
    this.setData({ studentKeyword: e.detail.value })
  },

  async onSearchStudent() {
    const kw = this.data.studentKeyword.trim()
    if (!kw) return

    const res = await studentAPI('list', { keyword: kw, page: 1, pageSize: 20 })
    if (res.code === 0) {
      this.setData({ studentList: res.data.list })
    }
  },

  onSelectStudent(e) {
    const student = e.detail.student
    this.setData({ selectedStudent: student, step: 'select_tags' })
    this.loadTags()
  },

  // ==================== Step 2: 选择标签 ====================
  async loadTags() {
    const res = await tagAPI('configList', {}, { silent: true })
    if (res.code === 0) {
      // 按 group 分组
      const tags = res.data.filter(t => t.is_enabled)
      const groups = {}
      tags.forEach(t => {
        const g = t.group || '其他'
        if (!groups[g]) groups[g] = []
        groups[g].push(t)
      })
      const tagGroups = Object.entries(groups).map(([group, items]) => ({ group, items }))
      this.setData({ tagGroups })
    }
  },

  onToggleTag(e) {
    const { name } = e.currentTarget.dataset
    let selected = [...this.data.selectedTags]
    const idx = selected.indexOf(name)
    if (idx > -1) {
      selected.splice(idx, 1)
    } else {
      selected.push(name)
    }
    this.setData({ selectedTags: selected })
  },

  onDescInput(e) {
    this.setData({ tagDescription: e.detail.value })
  },

  // ==================== Step 3: 确认提交 ====================
  onConfirmSubmit() {
    if (this.data.selectedTags.length === 0) {
      wx.showToast({ title: '请至少选择一个标签', icon: 'none' })
      return
    }

    this.setData({ step: 'confirm' })
  },

  async onSubmit() {
    if (this.data.submitting) return
    this.setData({ submitting: true })

    const res = await tagAPI('submit', {
      studentId: this.data.selectedStudent._id,
      tagNames: this.data.selectedTags,
      description: this.data.tagDescription.trim()
    }, { showLoading: true })

    this.setData({ submitting: false })

    if (res.code === 0) {
      const { addedTags, skippedTags, classification } = res.data
      let msg = `成功添加 ${addedTags.length} 个标签`
      if (skippedTags && skippedTags.length > 0) {
        msg += `，${skippedTags.length} 个已存在`
      }

      // 显示归类结果
      const parts = []
      if (classification.six.length > 0) parts.push(`六类: ${classification.six.join('、')}`)
      if (classification.four.length > 0) parts.push(`四特: ${classification.four.join('、')}`)
      if (classification.out_of_school.length > 0) parts.push(`在籍不在校: ${classification.out_of_school.join('、')}`)

      wx.showModal({
        title: '提交成功',
        content: `${msg}\n\n自动归类:\n${parts.join('\n')}`,
        showCancel: false,
        success: () => {
          // 重置
          this.setData({
            step: 'select_student',
            selectedStudent: null,
            selectedTags: [],
            tagDescription: '',
            studentKeyword: '',
            studentList: []
          })
        }
      })
    }
  },

  onBackToStudent() {
    this.setData({ step: 'select_student', selectedStudent: null, selectedTags: [], tagDescription: '' })
  },

  onBackToTags() {
    this.setData({ step: 'select_tags' })
  }
})
