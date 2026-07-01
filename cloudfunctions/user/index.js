// cloudfunctions/user/index.js — 用户管理
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// ========== 内置工具函数 ==========
function success(data = null, message = 'ok') { return { code: 0, message, data } }
function fail(code = 400, message = '操作失败') { return { code, message, data: null } }
function pageResult(list, total, page, pageSize) { return { code: 0, message: 'ok', data: { list, total, page, pageSize } } }
async function getUserByOpenId(db, openid) {
  if (!openid) return null
  const result = await db.collection('users').where({ openid, is_deleted: false }).get()
  return result.data[0] || null
}
function requireRole(user, allowedRoles) {
  if (!user) return fail(401, '用户未注册')
  if (!allowedRoles.includes(user.role)) return fail(403, '您没有操作权限')
  return null
}

// ========== 主入口 ==========
exports.main = async (event, context) => {
  const { action, data = {} } = event
  const { OPENID } = cloud.getWXContext()

  try {
    const user = await getUserByOpenId(db, OPENID)
    if (!user) return fail(401, '用户未注册')

    switch (action) {
      case 'list':        return await handleList(data, user)
      case 'updateRole':  return await handleUpdateRole(data, user)
      case 'bindClass':   return await handleBindClass(data, user)
      case 'detail':      return await handleDetail(data, user)
      default:            return fail(400, `未知操作: ${action}`)
    }
  } catch (err) {
    console.error('[user] 错误:', err)
    return fail(500, '服务器内部错误')
  }
}

// ==================== 用户列表 ====================
async function handleList(data, user) {
  const roleErr = requireRole(user, ['admin'])
  if (roleErr) return roleErr

  const { page = 1, pageSize = 20, role, keyword, status } = data
  const where = { is_deleted: false }
  if (role) where.role = role
  if (status) where.status = status
  if (keyword) where.name = db.RegExp({ regexp: keyword, options: 'i' })

  const total = await db.collection('users').where(where).count()
  const list = await db.collection('users').where(where)
    .orderBy('create_time', 'desc').skip((page - 1) * pageSize).limit(pageSize).get()

  const safeList = list.data.map(u => ({ ...u, phone: maskPhone(u.phone), openid: undefined }))
  return pageResult(safeList, total.total, page, pageSize)
}

// ==================== 更新角色/绑定班级 ====================
async function handleUpdateRole(data, user) {
  const roleErr = requireRole(user, ['admin'])
  if (roleErr) return roleErr

  const { userId, role, classId, className, gradeId } = data
  if (!userId) return fail(400, '用户ID不能为空')

  const target = await db.collection('users').doc(userId).get()
  if (!target.data) return fail(404, '用户不存在')

  const updateData = { update_time: Date.now() }
  if (role) { updateData.role = role; updateData.role_label = getRoleLabel(role); updateData.org_path = getOrgPath(role) }
  if (classId !== undefined) updateData.class_id = classId
  if (className !== undefined) updateData.class_name = className
  if (gradeId !== undefined) updateData.grade_id = gradeId

  await db.collection('users').doc(userId).update({ data: updateData })
  return success(null, '更新成功')
}

// ==================== 班主任绑定班级 ====================
async function handleBindClass(data, user) {
  if (user.role !== 'class_teacher') return fail(403, '只有班主任需要绑定班级')
  const { classId, className, gradeId } = data
  if (!classId) return fail(400, '班级ID不能为空')

  await db.collection('users').doc(user._id).update({
    data: { class_id: classId, class_name: className || '', grade_id: gradeId || '', update_time: Date.now() }
  })
  return success(null, '班级绑定成功')
}

// ==================== 用户详情 ====================
async function handleDetail(data, user) {
  const roleErr = requireRole(user, ['admin', 'director', 'vice_director'])
  if (roleErr) return roleErr

  const { userId } = data
  if (!userId) return fail(400, '用户ID不能为空')
  const target = await db.collection('users').doc(userId).get()
  if (!target.data) return fail(404, '用户不存在')
  const u = target.data
  return success({ ...u, phone: maskPhone(u.phone), openid: undefined })
}

// ==================== 辅助 ====================
function maskPhone(phone) {
  if (!phone || phone.length < 7) return phone
  return phone.substring(0, 3) + '****' + phone.substring(7)
}
function getRoleLabel(role) {
  const labels = { admin:'管理员', principal:'校长', vice_principal:'德育/安全副校长', director:'德育处主任', vice_director:'德育处副主任', safety_head:'安全办主任', class_teacher:'班主任', psychology_teacher:'心理老师', instructor:'教官', safety_member:'安全办成员' }
  return labels[role] || role
}
function getOrgPath(role) {
  const paths = { admin:['管理员'], principal:['校长'], vice_principal:['副校长'], director:['副校长','德育处','德育处主任'], vice_director:['副校长','德育处','德育处副主任'], safety_head:['副校长','安全办','安全办主任'], class_teacher:['副校长','德育处','班主任'], psychology_teacher:['副校长','德育处','心理老师'], instructor:['副校长','德育处','教官'], safety_member:['副校长','安全办','安全办成员'] }
  return paths[role] || []
}
