// components/student-card/index.js — 学生卡片
Component({
  properties: {
    student: { type: Object, value: {} },
    showTags: { type: Boolean, value: true },
    showClass: { type: Boolean, value: true },
    tapable: { type: Boolean, value: true }
  },
  methods: {
    onTap() {
      if (this.properties.tapable) {
        this.triggerEvent('select', { student: this.properties.student })
      }
    }
  }
})
