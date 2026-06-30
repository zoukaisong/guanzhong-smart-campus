// utils/date.js — 日期工具函数

/**
 * 格式化时间戳为日期字符串
 * @param {number} timestamp - 毫秒时间戳
 * @param {string} format - 格式 'date' | 'datetime' | 'time'
 * @returns {string}
 */
function formatDate(timestamp, format = 'date') {
  if (!timestamp) return ''
  const d = new Date(timestamp)
  const year = d.getFullYear()
  const month = padZero(d.getMonth() + 1)
  const day = padZero(d.getDate())
  const hour = padZero(d.getHours())
  const minute = padZero(d.getMinutes())

  switch (format) {
    case 'datetime':
      return `${year}-${month}-${day} ${hour}:${minute}`
    case 'time':
      return `${hour}:${minute}`
    case 'date':
    default:
      return `${year}-${month}-${day}`
  }
}

/**
 * 获取今天的日期字符串
 * @returns {string} YYYY-MM-DD
 */
function today() {
  return formatDate(Date.now())
}

/**
 * 计算两个日期相差的天数
 * @param {string|number} date1
 * @param {string|number} date2
 * @returns {number}
 */
function daysDiff(date1, date2) {
  const d1 = new Date(date1).getTime()
  const d2 = new Date(date2).getTime()
  return Math.floor(Math.abs(d1 - d2) / (1000 * 60 * 60 * 24))
}

/**
 * 获取距今 N 天前的日期字符串
 * @param {number} n - 天数
 * @returns {string} YYYY-MM-DD
 */
function daysAgo(n) {
  const d = new Date(Date.now() - n * 24 * 60 * 60 * 1000)
  return formatDate(d.getTime())
}

/**
 * 获取当前学期标识
 * 学期从9月到次年1月为第一学期(-1)，2月到7月为第二学期(-2)
 * @returns {string} 如 '2026-2027-1'
 */
function getCurrentSemester() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  if (month >= 9) {
    return `${year}-${year + 1}-1`
  } else if (month <= 1) {
    return `${year - 1}-${year}-1`
  } else {
    return `${year - 1}-${year}-2`
  }
}

/**
 * 根据第一周起始日期计算当前属于第几周
 * @param {string} firstWeekDate - 第一周起始日期（周一）YYYY-MM-DD
 * @param {number} totalWeeks - 学期总周数
 * @returns {Object} { weekNo, isEnded }
 */
function getCurrentWeek(firstWeekDate, totalWeeks = 20) {
  if (!firstWeekDate) return { weekNo: null, isEnded: false }

  const firstDay = new Date(firstWeekDate)
  const today = new Date()
  const diffDays = Math.floor((today.getTime() - firstDay.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    return { weekNo: null, isEnded: false }
  }

  const weekNo = Math.floor(diffDays / 7) + 1

  if (weekNo > totalWeeks) {
    return { weekNo: totalWeeks, isEnded: true }
  }

  return { weekNo, isEnded: false }
}

/**
 * 获取学期起始年份
 * @param {string} semester - '2024-2025-1'
 * @returns {number}
 */
function getEnrollYearFromSemester(semester) {
  // 对学生来说，入学年份是固定的，这里取学期起始年份
  if (!semester) return new Date().getFullYear()
  return parseInt(semester.split('-')[0])
}

function padZero(n) {
  return n < 10 ? '0' + n : '' + n
}

module.exports = {
  formatDate,
  today,
  daysDiff,
  daysAgo,
  getCurrentSemester,
  getCurrentWeek,
  getEnrollYearFromSemester
}
