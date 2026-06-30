// utils/idcard.js — 身份证脱敏工具

/**
 * 身份证脱敏：仅显示后4位
 * @param {string} idCard - 18位身份证号
 * @returns {string} 如 '**** **** **** 1234'
 */
function maskIdCard(idCard) {
  if (!idCard || idCard.length < 4) return '****'
  const last4 = idCard.slice(-4)
  return `**** **** **** ${last4}`
}

/**
 * 从身份证提取性别
 * @param {string} idCard - 18位身份证号
 * @returns {string} 'male' | 'female' | null
 */
function getGenderFromIdCard(idCard) {
  if (!idCard || idCard.length !== 18) return null
  const genderCode = parseInt(idCard.charAt(16))
  return genderCode % 2 === 0 ? 'female' : 'male'
}

/**
 * 从身份证提取出生日期
 * @param {string} idCard - 18位身份证号
 * @returns {string} YYYY-MM-DD
 */
function getBirthFromIdCard(idCard) {
  if (!idCard || idCard.length < 14) return ''
  const year = idCard.substring(6, 10)
  const month = idCard.substring(10, 12)
  const day = idCard.substring(12, 14)
  return `${year}-${month}-${day}`
}

/**
 * 验证并提取身份证最后4位
 * @param {string} idCard - 18位身份证号
 * @returns {string|null}
 */
function getIdCardLast4(idCard) {
  if (!idCard || idCard.length < 4) return null
  return idCard.slice(-4)
}

module.exports = {
  maskIdCard,
  getGenderFromIdCard,
  getBirthFromIdCard,
  getIdCardLast4
}
