// utils/request.js — 云函数调用封装

const { CLOUD_FUNCTIONS } = require('./constants')

/**
 * 调用云函数
 * @param {string} name - 云函数名称
 * @param {Object} params - 参数 { action, data }
 * @param {Object} options - 选项 { showLoading, showError, silent }
 * @returns {Promise<Object>} { code, message, data }
 */
async function callCloudFunction(name, params = {}, options = {}) {
  const { showLoading = false, showError = true, silent = false } = options

  if (showLoading) {
    wx.showLoading({ title: '加载中...', mask: true })
  }

  try {
    const result = await wx.cloud.callFunction({ name, data: params })
    const res = result.result || {}

    if (res.code !== 0 && res.code !== undefined) {
      if (showError && !silent) {
        wx.showToast({ title: res.message || '操作失败', icon: 'none', duration: 2000 })
      }
    }

    return res
  } catch (err) {
    console.error(`[云函数调用失败] ${name}/${params.action}:`, err)

    // 处理云函数未部署的情况
    if (err.errCode === -1 && err.errMsg && err.errMsg.includes('not found')) {
      if (!silent) {
        wx.showToast({ title: `云函数 [${name}] 未部署，请先上传`, icon: 'none', duration: 3000 })
      }
      return { code: -1, message: `云函数 ${name} 未部署`, data: null }
    }

    if (showError && !silent) {
      wx.showToast({ title: '网络异常，请重试', icon: 'none' })
    }
    return { code: -1, message: err.errMsg || '网络异常', data: null }
  } finally {
    if (showLoading) {
      wx.hideLoading()
    }
  }
}

/**
 * 调用 auth 云函数
 */
async function authAPI(action, data = {}, options = {}) {
  return callCloudFunction(CLOUD_FUNCTIONS.AUTH, { action, data }, options)
}

/**
 * 调用 user 云函数
 */
async function userAPI(action, data = {}, options = {}) {
  return callCloudFunction(CLOUD_FUNCTIONS.USER, { action, data }, options)
}

/**
 * 调用 student 云函数
 */
async function studentAPI(action, data = {}, options = {}) {
  return callCloudFunction(CLOUD_FUNCTIONS.STUDENT, { action, data }, options)
}

/**
 * 调用 tag 云函数
 */
async function tagAPI(action, data = {}, options = {}) {
  return callCloudFunction(CLOUD_FUNCTIONS.TAG, { action, data }, options)
}

/**
 * 调用 discipline 云函数
 */
async function disciplineAPI(action, data = {}, options = {}) {
  return callCloudFunction(CLOUD_FUNCTIONS.DISCIPLINE, { action, data }, options)
}

/**
 * 调用 safety 云函数
 */
async function safetyAPI(action, data = {}, options = {}) {
  return callCloudFunction(CLOUD_FUNCTIONS.SAFETY, { action, data }, options)
}

/**
 * 调用 contraband 云函数
 */
async function contrabandAPI(action, data = {}, options = {}) {
  return callCloudFunction(CLOUD_FUNCTIONS.CONTRABAND, { action, data }, options)
}

/**
 * 调用 patrol 云函数
 */
async function patrolAPI(action, data = {}, options = {}) {
  return callCloudFunction(CLOUD_FUNCTIONS.PATROL, { action, data }, options)
}

/**
 * 调用 moral 云函数
 */
async function moralAPI(action, data = {}, options = {}) {
  return callCloudFunction(CLOUD_FUNCTIONS.MORAL, { action, data }, options)
}

/**
 * 调用 export 云函数
 */
async function exportAPI(action, data = {}, options = {}) {
  return callCloudFunction(CLOUD_FUNCTIONS.EXPORT, { action, data }, options)
}

module.exports = {
  callCloudFunction,
  authAPI,
  userAPI,
  studentAPI,
  tagAPI,
  disciplineAPI,
  safetyAPI,
  contrabandAPI,
  patrolAPI,
  moralAPI,
  exportAPI
}
