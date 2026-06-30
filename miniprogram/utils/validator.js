// utils/validator.js — 表单校验工具

/**
 * 校验手机号
 * @param {string} phone - 手机号
 * @returns {string|null} 错误信息，null 表示通过
 */
function validatePhone(phone) {
  if (!phone || phone.trim() === '') return null  // 非必填允许为空
  const phoneReg = /^1[3-9]\d{9}$/
  if (!phoneReg.test(phone.trim())) {
    return '手机号格式不正确'
  }
  return null
}

/**
 * 校验身份证号（18位）
 * @param {string} idCard - 身份证号
 * @returns {string|null} 错误信息，null 表示通过
 */
function validateIdCard(idCard) {
  if (!idCard || idCard.trim() === '') return '身份证号不能为空'
  const idcardReg = /^[1-9]\d{5}(18|19|20)?\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/
  if (!idcardReg.test(idCard.trim())) {
    return '身份证号格式不正确'
  }

  // 校验位验证
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]
  const checkCodes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2']
  const id17 = idCard.trim().substring(0, 17)
  let sum = 0
  for (let i = 0; i < 17; i++) {
    sum += parseInt(id17[i]) * weights[i]
  }
  const expectedCheck = checkCodes[sum % 11]
  if (idCard.trim()[17].toUpperCase() !== expectedCheck) {
    return '身份证号校验位不正确'
  }
  return null
}

/**
 * 校验学生姓名
 * @param {string} name - 姓名
 * @returns {string|null} 错误信息，null 表示通过
 */
function validateStudentName(name) {
  if (!name || name.trim() === '') return '学生姓名不能为空'
  if (name.trim().length < 2) return '姓名至少2个字符'
  if (name.trim().length > 20) return '姓名不能超过20个字符'
  return null
}

/**
 * 校验必填字段
 * @param {Object} data - 数据对象
 * @param {Object} rules - 校验规则 { field: '字段名' }
 * @returns {string|null} 第一个错误信息，null 表示全部通过
 */
function validateRequired(data, rules) {
  for (const [field, label] of Object.entries(rules)) {
    const value = data[field]
    if (value === undefined || value === null || value === '') {
      return `${label}不能为空`
    }
  }
  return null
}

/**
 * 校验家长信息（父亲和母亲至少有一组完整信息）
 * @param {Object} data - 学生数据
 * @returns {string|null}
 */
function validateParentInfo(data) {
  const fatherValid = data.father_name && data.father_name.trim() !== ''
    && data.father_phone && data.father_phone.trim() !== ''
  const motherValid = data.mother_name && data.mother_name.trim() !== ''
    && data.mother_phone && data.mother_phone.trim() !== ''

  if (!fatherValid && !motherValid) {
    return '父亲和母亲信息至少需要填写一组（姓名+电话）'
  }

  // 校验手机号格式
  if (fatherValid) {
    const err = validatePhone(data.father_phone)
    if (err) return `父亲${err}`
  }
  if (motherValid) {
    const err = validatePhone(data.mother_phone)
    if (err) return `母亲${err}`
  }
  return null
}

/**
 * 校验图片数量
 * @param {Array} photos - 图片列表
 * @param {number} min - 最少张数
 * @param {number} max - 最多张数
 * @returns {string|null}
 */
function validatePhotoCount(photos = [], min = 1, max = 3) {
  if (photos.length < min) return `至少上传${min}张照片`
  if (photos.length > max) return `最多上传${max}张照片`
  return null
}

/**
 * 校验日期字符串格式 YYYY-MM-DD
 */
function validateDate(dateStr) {
  if (!dateStr) return null
  const dateReg = /^\d{4}-\d{2}-\d{2}$/
  if (!dateReg.test(dateStr)) return '日期格式不正确（YYYY-MM-DD）'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '日期不存在'
  return null
}

module.exports = {
  validatePhone,
  validateIdCard,
  validateStudentName,
  validateRequired,
  validateParentInfo,
  validatePhotoCount,
  validateDate
}
