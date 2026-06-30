// pages/login/index.js — 登录页
const { authAPI } = require('../../utils/request')
const { ROLE_LABELS } = require('../../utils/constants')
const { isLoggedIn } = require('../../utils/auth')

Page({
  data: {
    step: 'login',       // login | register | pending
    name: '',
    phone: '',
    selectedRole: '',
    roleOptions: [
      { value: 'principal', label: ROLE_LABELS.principal },
      { value: 'vice_principal', label: ROLE_LABELS.vice_principal },
      { value: 'director', label: ROLE_LABELS.director },
      { value: 'vice_director', label: ROLE_LABELS.vice_director },
      { value: 'safety_head', label: ROLE_LABELS.safety_head },
      { value: 'class_teacher', label: ROLE_LABELS.class_teacher },
      { value: 'psychology_teacher', label: ROLE_LABELS.psychology_teacher },
      { value: 'instructor', label: ROLE_LABELS.instructor },
      { value: 'safety_member', label: ROLE_LABELS.safety_member }
    ],
    submitting: false
  },

  onLoad() {
    if (isLoggedIn()) {
      wx.switchTab({ url: '/pages/home/index' })
    }
  },

  // ==================== Step 1: 微信登录 ====================
  async onTapWxLogin() {
    this.setData({ submitting: true })
    wx.showLoading({ title: '登录中...', mask: true })

    try {
      const res = await authAPI('login')
      wx.hideLoading()

      if (res.code !== 0) return

      const { registered, status } = res.data
      if (!registered) {
        // 未注册，进入注册页
        this.setData({ step: 'register' })
      } else if (status === 'approved') {
        // 已审核，保存用户信息并跳转
        getApp().setUser(res.data.user)
        wx.showToast({ title: '登录成功', icon: 'success' })
        setTimeout(() => wx.switchTab({ url: '/pages/home/index' }), 500)
      } else if (status === 'pending') {
        this.setData({ step: 'pending' })
      } else if (status === 'rejected') {
        wx.showModal({
          title: '审核未通过',
          content: '您的账号审核未通过，请重新注册',
          confirmText: '重新注册',
          success: (modalRes) => {
            if (modalRes.confirm) this.setData({ step: 'register' })
          }
        })
      }
    } finally {
      this.setData({ submitting: false })
    }
  },

  // ==================== Step 2: 注册 ====================
  onNameInput(e) { this.setData({ name: e.detail.value }) },
  onPhoneInput(e) { this.setData({ phone: e.detail.value }) },

  onSelectRole(e) {
    this.setData({ selectedRole: e.currentTarget.dataset.role })
  },

  async onTapSubmitRegister() {
    const { name, phone, selectedRole } = this.data
    if (!name.trim()) return wx.showToast({ title: '请输入姓名', icon: 'none' })
    if (!phone.trim() || !/^1[3-9]\d{9}$/.test(phone.trim())) {
      return wx.showToast({ title: '请输入正确的手机号', icon: 'none' })
    }
    if (!selectedRole) return wx.showToast({ title: '请选择身份', icon: 'none' })

    this.setData({ submitting: true })

    const res = await authAPI('register', { name: name.trim(), phone: phone.trim(), role: selectedRole }, { showLoading: true })

    this.setData({ submitting: false })

    if (res.code === 0) {
      wx.showToast({ title: res.message, icon: 'success' })
      this.setData({ step: 'pending' })
    }
  },

  // ==================== Step 3: 等待审核 ====================
  async onTapRefreshStatus() {
    this.onTapWxLogin()
  }
})
