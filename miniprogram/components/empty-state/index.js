// components/empty-state/index.js — 空状态
Component({
  properties: {
    text: { type: String, value: '暂无数据' },
    icon: { type: String, value: '📋' },
    showBtn: { type: Boolean, value: false },
    btnText: { type: String, value: '去添加' }
  },
  methods: {
    onTapBtn() {
      this.triggerEvent('action')
    }
  }
})
