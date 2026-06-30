// components/navbar/index.js — 顶部导航栏
Component({
  properties: {
    title: { type: String, value: '关中智慧校园' },
    showBack: { type: Boolean, value: false },
    backgroundColor: { type: String, value: '#1a6e3e' }
  },
  methods: {
    onTapBack() {
      wx.navigateBack()
    }
  }
})
