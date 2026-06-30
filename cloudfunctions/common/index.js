// cloudfunctions/common/index.js — 云函数公共工具

/**
 * 成功返回
 * @param {*} data - 返回数据
 * @param {string} message - 提示信息
 */
function success(data = null, message = 'ok') {
  return { code: 0, message, data }
}

/**
 * 失败返回
 * @param {number} code - 错误码 400|401|403|404|422|500
 * @param {string} message - 错误信息
 */
function fail(code = 400, message = '操作失败') {
  return { code, message, data: null }
}

/**
 * 分页返回
 * @param {Array} list - 数据列表
 * @param {number} total - 总记录数
 * @param {number} page - 当前页码
 * @param {number} pageSize - 每页条数
 */
function pageResult(list, total, page, pageSize) {
  return {
    code: 0,
    message: 'ok',
    data: { list, total, page, pageSize }
  }
}

// ==================== 权限工具 ====================

/**
 * 根据 openid 查询用户
 * @param {Object} db - 数据库实例
 * @param {string} openid - 微信 openid
 * @returns {Object|null} 用户对象或 null
 */
async function getUserByOpenId(db, openid) {
  if (!openid) return null
  const result = await db.collection('users')
    .where({ openid, is_deleted: false })
    .get()
  return result.data[0] || null
}

/**
 * 角色权限校验
 * @param {Object} user - 当前用户
 * @param {string[]} allowedRoles - 允许的角色列表
 * @returns {Object|null} 无权限时返回错误对象，有权限返回 null
 */
function requireRole(user, allowedRoles) {
  if (!user) return fail(401, '用户未注册')
  if (!allowedRoles.includes(user.role)) {
    return fail(403, '您没有操作权限')
  }
  return null
}

/**
 * 构建基于角色的数据权限过滤条件
 * @param {Object} user - 当前用户
 * @param {Object} baseWhere - 基础查询条件
 * @returns {Object} 合并后的查询条件
 */
function buildPermissionFilter(user, baseWhere = {}) {
  const where = { is_deleted: false, ...baseWhere }

  switch (user.role) {
    case 'class_teacher':
      // 班主任只能看自己班级
      if (user.class_id) {
        where.class_id = user.class_id
      } else {
        // 如果班主任还没有绑定班级，强制返回空
        where.class_id = '__none__'
      }
      break

    case 'psychology_teacher':
      // 心理老师只看心理类学生（tags 中包含 category_6='心理类' 或 category_4='特异心理'）
      // 由调用方在业务层处理，这里不做硬限制
      break

    case 'principal':
    case 'vice_principal':
    case 'admin':
    case 'director':
    case 'vice_director':
      // 管理层可看全校，不做额外限制
      break

    default:
      // 其他角色只看自己的记录
      where.submitter_id = user._id
      break
  }

  return where
}

/**
 * 生成自定义 ID
 * @param {string} prefix - 前缀，如 'student', 'discipline'
 * @returns {string} 如 'student_20240622001'
 */
function generateId(prefix) {
  const now = new Date()
  const dateStr = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')
  ].join('')
  const random = String(Math.floor(Math.random() * 1000)).padStart(3, '0')
  return `${prefix}_${dateStr}${random}`
}

/**
 * 获取当前学期标识
 * @param {Object} db - 数据库实例
 * @returns {Promise<string>} 当前学期标识，如 '2026-2027-1'
 */
async function getCurrentSemester(db) {
  const result = await db.collection('config_semester')
    .where({ is_current: true })
    .get()
  if (result.data.length > 0) {
    return result.data[0]._id
  }
  // 回退：根据日期计算
  return computeSemester()
}

/**
 * 根据当前日期推算学期
 */
function computeSemester() {
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

module.exports = {
  success,
  fail,
  pageResult,
  getUserByOpenId,
  requireRole,
  buildPermissionFilter,
  generateId,
  getCurrentSemester
}
