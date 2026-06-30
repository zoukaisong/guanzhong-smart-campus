// pages/admin/settings/index.js — 系统设置（管理员，占位页面）
const { isAdmin } = require('../../../utils/auth')

Page({
  data: {
    isAdmin: false,
    settings: [
      { title: '组织架构管理', icon: '🏫', desc: '年级/班级/部门管理' },
      { title: '角色权限管理', icon: '👥', desc: '用户角色分配与权限配置' },
      { title: '标签映射配置', icon: '🏷️', desc: '标签→六类/四特/在籍不在校映射' },
      { title: '违禁品类型管理', icon: '📱', desc: '维护违禁品类型列表' },
      { title: '打卡位置管理', icon: '📍', desc: '预设巡逻打卡楼栋和楼层' },
      { title: '学期配置', icon: '📅', desc: '设置当前学期和第一周日期' },
      { title: '年级升级', icon: '🔄', desc: '手动触发年级自动升级' }
    ]
  },

  onShow() {
    this.setData({ isAdmin: isAdmin() })
  },

  onTapSetting(e) {
    const { title } = e.currentTarget.dataset
    wx.showToast({ title: `${title} 功能开发中`, icon: 'none' })
  }
})
