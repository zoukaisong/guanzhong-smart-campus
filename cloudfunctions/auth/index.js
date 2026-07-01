// cloudfunctions/auth/index.js — 登录鉴权
const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloudbase-d4glzztw6048b36b4' })
const db = cloud.database()
const _ = db.command

// ========== 内置工具函数 ==========
function success(data = null, message = 'ok') {
  return { code: 0, message, data }
}
function fail(code = 400, message = '操作失败') {
  return { code, message, data: null }
}
async function getUserByOpenId(db, openid) {
  if (!openid) return null
  const result = await db.collection('users').where({ openid, is_deleted: _.neq(true) }).get()
  return result.data[0] || null
}
function generateId(prefix) {
  const now = new Date()
  const dateStr = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('')
  const random = String(Math.floor(Math.random() * 1000)).padStart(3, '0')
  return `${prefix}_${dateStr}${random}`
}

// ========== 主入口 ==========
exports.main = async (event, context) => {
  const { action, data = {} } = event
  const { OPENID } = cloud.getWXContext()

  console.log(`[auth] action=${action} openid=${OPENID}`)

  try {
    switch (action) {
      case 'login':       return await handleLogin(OPENID)
      case 'register':    return await handleRegister(OPENID, data)
      case 'approve':     return await handleApprove(OPENID, data)
      case 'reject':      return await handleReject(OPENID, data)
      case 'pendingList': return await handlePendingList(OPENID, data)
      case 'currentUser': return await handleCurrentUser(OPENID)
      default:            return fail(400, `未知操作: ${action}`)
    }
  } catch (err) {
    console.error('[auth] 错误:', err)
    return fail(500, '服务器内部错误')
  }
}

// ==================== 登录 ====================
async function handleLogin(openid) {
  if (!openid) return fail(401, '微信登录失败，请重试')
  const user = await getUserByOpenId(db, openid)

  if (!user) return success({ registered: false, openid }, '请先注册')
  if (user.status === 'pending') return success({ registered: true, status: 'pending' }, '账号正在审核中')
  if (user.status === 'rejected') return success({ registered: true, status: 'rejected' }, '账号审核未通过')

  return success({
    registered: true,
    status: 'approved',
    user: {
      _id: user._id, name: user.name, phone: maskPhone(user.phone),
      role: user.role, role_label: user.role_label,
      class_id: user.class_id || '', class_name: user.class_name || '', grade_id: user.grade_id || ''
    }
  }, '登录成功')
}

// ==================== 注册 ====================
async function handleRegister(openid, data) {
  if (!openid) return fail(401, '微信登录失败')
  const { name, phone, role } = data
  if (!name || !phone || !role) return fail(400, '姓名、手机号、角色均为必填')
  if (!/^1[3-9]\d{9}$/.test(phone)) return fail(400, '手机号格式不正确')

  const allowedRoles = ['principal', 'vice_principal', 'director', 'vice_director', 'safety_head', 'class_teacher', 'psychology_teacher', 'instructor', 'safety_member']
  if (!allowedRoles.includes(role)) return fail(400, '无效的角色类型')
  if (role === 'admin') return fail(403, '管理员不可自行注册')

  const existing = await db.collection('users').where({ openid, is_deleted: _.neq(true) }).get()
  if (existing.data.length > 0) {
    const u = existing.data[0]
    if (u.status === 'approved') return fail(422, '您已注册并通过审核')
    if (u.status === 'pending') return fail(422, '您的注册申请正在审核中')
    await db.collection('users').doc(u._id).update({
      data: { name, phone, role, role_label: getRoleLabel(role), org_path: getOrgPath(role), status: 'pending', update_time: Date.now() }
    })
    return success({ userId: u._id }, '注册申请已重新提交')
  }

  const userId = generateId('user')
  await db.collection('users').add({
    data: {
      _id: userId, openid, name, phone, role,
      role_label: getRoleLabel(role), org_path: getOrgPath(role),
      class_id: '', class_name: '', grade_id: '',
      status: 'pending', create_time: Date.now(), update_time: Date.now(), is_deleted: false
    }
  })
  return success({ userId }, '注册申请已提交，请等待管理员审核')
}

// ==================== 管理员审核 ====================
async function handleApprove(openid, data) {
  const admin = await getUserByOpenId(db, openid)
  if (!admin || admin.role !== 'admin') return fail(403, '仅管理员可审核用户')
  const { userId } = data
  if (!userId) return fail(400, '用户ID不能为空')

  const userResult = await db.collection('users').doc(userId).get()
  if (!userResult.data) return fail(404, '用户不存在')
  if (userResult.data.status !== 'pending') return fail(422, '该用户不是待审核状态')

  await db.collection('users').doc(userId).update({
    data: { status: 'approved', approved_by: admin._id, approved_time: Date.now(), update_time: Date.now() }
  })
  return success(null, '审核通过')
}

async function handleReject(openid, data) {
  const admin = await getUserByOpenId(db, openid)
  if (!admin || admin.role !== 'admin') return fail(403, '仅管理员可审核用户')
  const { userId, reason } = data
  if (!userId) return fail(400, '用户ID不能为空')

  await db.collection('users').doc(userId).update({
    data: { status: 'rejected', approve_reason: reason || '', approved_by: admin._id, approved_time: Date.now(), update_time: Date.now() }
  })
  return success(null, '已拒绝')
}

// ==================== 待审核列表 ====================
async function handlePendingList(openid, data) {
  const admin = await getUserByOpenId(db, openid)
  if (!admin || admin.role !== 'admin') return fail(403, '仅管理员可查看')
  const { page = 1, pageSize = 20 } = data

  const total = await db.collection('users').where({ status: 'pending', is_deleted: _.neq(true) }).count()
  console.log('[auth] pendingList: total=' + total.total + ', admin=' + admin.name)
  const list = await db.collection('users').where({ status: 'pending', is_deleted: _.neq(true) })
    .orderBy('create_time', 'desc').skip((page - 1) * pageSize).limit(pageSize).get()

  const safeList = list.data.map(u => ({ ...u, phone: maskPhone(u.phone), openid: undefined }))
  return { code: 0, message: 'ok', data: { list: safeList, total: total.total, page, pageSize } }
}

// ==================== 当前用户 ====================
async function handleCurrentUser(openid) {
  if (!openid) return fail(401, '未登录')
  const user = await getUserByOpenId(db, openid)
  if (!user) return fail(401, '用户未注册')
  return success({ registered: true, status: user.status, user: { _id: user._id, name: user.name, phone: maskPhone(user.phone), role: user.role, role_label: user.role_label, class_id: user.class_id || '', class_name: user.class_name || '', grade_id: user.grade_id || '' } })
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
