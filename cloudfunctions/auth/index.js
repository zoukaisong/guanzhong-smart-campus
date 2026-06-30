// cloudfunctions/auth/index.js — 登录鉴权
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const $ = db.command.aggregate

const { success, fail, getUserByOpenId, generateId } = require('../common/index')

exports.main = async (event, context) => {
  const { action, data = {} } = event
  const { OPENID } = cloud.getWXContext()

  console.log(`[auth] action=${action} openid=${OPENID}`)

  try {
    switch (action) {
      // ---- 登录 ----
      case 'login':
        return await handleLogin(OPENID)
      // ---- 注册 ----
      case 'register':
        return await handleRegister(OPENID, data)
      // ---- 管理员审核用户 ----
      case 'approve':
        return await handleApprove(OPENID, data)
      // ---- 管理员拒绝用户 ----
      case 'reject':
        return await handleReject(OPENID, data)
      // ---- 获取待审核列表（管理员） ----
      case 'pendingList':
        return await handlePendingList(OPENID, data)
      // ---- 获取当前用户信息 ----
      case 'currentUser':
        return await handleCurrentUser(OPENID)
      default:
        return fail(400, `未知操作: ${action}`)
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

  if (!user) {
    // 用户不存在，引导注册
    return success({ registered: false, openid }, '请先注册')
  }

  if (user.status === 'pending') {
    return success({ registered: true, status: 'pending' }, '账号正在审核中，请耐心等待')
  }

  if (user.status === 'rejected') {
    return success({ registered: true, status: 'rejected' }, '账号审核未通过，请重新注册')
  }

  // 登录成功，返回用户信息（脱敏）
  return success({
    registered: true,
    status: 'approved',
    user: {
      _id: user._id,
      name: user.name,
      phone: maskPhone(user.phone),
      role: user.role,
      role_label: user.role_label,
      class_id: user.class_id || '',
      class_name: user.class_name || '',
      grade_id: user.grade_id || '',
      org_path: user.org_path || []
    }
  }, '登录成功')
}

// ==================== 注册 ====================
async function handleRegister(openid, data) {
  if (!openid) return fail(401, '微信登录失败')

  const { name, phone, role } = data

  // 校验
  if (!name || !phone || !role) {
    return fail(400, '姓名、手机号、角色均为必填')
  }

  if (!validatePhone(phone)) return fail(400, '手机号格式不正确')

  // 角色合法性
  const allowedRoles = [
    'principal', 'vice_principal', 'director', 'vice_director',
    'safety_head', 'class_teacher', 'psychology_teacher',
    'instructor', 'safety_member'
  ]
  if (!allowedRoles.includes(role)) {
    return fail(400, '无效的角色类型')
  }

  // 禁止自行注册管理员
  if (role === 'admin') {
    return fail(403, '管理员不可自行注册')
  }

  // 检查是否已注册
  const existing = await db.collection('users')
    .where({ openid, is_deleted: false })
    .get()

  if (existing.data.length > 0) {
    const u = existing.data[0]
    if (u.status === 'approved') {
      return fail(422, '您已注册并通过审核，请直接登录')
    }
    if (u.status === 'pending') {
      return fail(422, '您的注册申请正在审核中')
    }
    // 之前被拒绝，允许重新提交
    await db.collection('users').doc(u._id).update({
      data: {
        name,
        phone,
        role,
        role_label: getRoleLabel(role),
        org_path: getOrgPath(role),
        status: 'pending',
        update_time: Date.now()
      }
    })
    return success({ userId: u._id }, '注册申请已重新提交，请等待管理员审核')
  }

  // 生成 role_label 和 org_path
  const roleLabel = getRoleLabel(role)
  const orgPath = getOrgPath(role)

  const userId = generateId('user')
  const userDoc = {
    _id: userId,
    openid,
    name,
    phone,
    role,
    role_label: roleLabel,
    org_path: orgPath,
    class_id: '',
    class_name: '',
    grade_id: '',
    status: 'pending',
    create_time: Date.now(),
    update_time: Date.now(),
    is_deleted: false
  }

  await db.collection('users').add({ data: userDoc })

  return success({ userId }, '注册申请已提交，请等待管理员审核')
}

// ==================== 管理员审核通过 ====================
async function handleApprove(openid, data) {
  // 鉴权：仅管理员
  const admin = await getUserByOpenId(db, openid)
  if (!admin || admin.role !== 'admin') {
    return fail(403, '仅管理员可审核用户')
  }

  const { userId } = data
  if (!userId) return fail(400, '用户ID不能为空')

  const userResult = await db.collection('users').doc(userId).get()
  if (!userResult.data) {
    return fail(404, '用户不存在')
  }
  if (userResult.data.status !== 'pending') {
    return fail(422, '该用户不是待审核状态')
  }

  await db.collection('users').doc(userId).update({
    data: {
      status: 'approved',
      approved_by: admin._id,
      approved_time: Date.now(),
      update_time: Date.now()
    }
  })

  return success(null, '审核通过')
}

// ==================== 管理员拒绝 ====================
async function handleReject(openid, data) {
  const admin = await getUserByOpenId(db, openid)
  if (!admin || admin.role !== 'admin') {
    return fail(403, '仅管理员可审核用户')
  }

  const { userId, reason } = data
  if (!userId) return fail(400, '用户ID不能为空')

  const userResult = await db.collection('users').doc(userId).get()
  if (!userResult.data) return fail(404, '用户不存在')

  await db.collection('users').doc(userId).update({
    data: {
      status: 'rejected',
      approve_reason: reason || '',
      approved_by: admin._id,
      approved_time: Date.now(),
      update_time: Date.now()
    }
  })

  return success(null, '已拒绝')
}

// ==================== 待审核列表 ====================
async function handlePendingList(openid, data) {
  const admin = await getUserByOpenId(db, openid)
  if (!admin || admin.role !== 'admin') {
    return fail(403, '仅管理员可查看')
  }

  const { page = 1, pageSize = 20 } = data

  const total = await db.collection('users')
    .where({ status: 'pending', is_deleted: false })
    .count()

  const list = await db.collection('users')
    .where({ status: 'pending', is_deleted: false })
    .orderBy('create_time', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()

  // 脱敏手机号
  const safeList = list.data.map(u => ({
    ...u,
    phone: maskPhone(u.phone)
  }))

  return {
    code: 0,
    message: 'ok',
    data: { list: safeList, total: total.total, page, pageSize }
  }
}

// ==================== 当前用户信息 ====================
async function handleCurrentUser(openid) {
  if (!openid) return fail(401, '未登录')
  const user = await getUserByOpenId(db, openid)
  if (!user) return fail(401, '用户未注册')

  return success({
    registered: true,
    status: user.status,
    user: {
      _id: user._id,
      name: user.name,
      phone: maskPhone(user.phone),
      role: user.role,
      role_label: user.role_label,
      class_id: user.class_id || '',
      class_name: user.class_name || '',
      grade_id: user.grade_id || ''
    }
  })
}

// ==================== 辅助函数 ====================

function maskPhone(phone) {
  if (!phone || phone.length < 7) return phone
  return phone.substring(0, 3) + '****' + phone.substring(7)
}

function validatePhone(phone) {
  return /^1[3-9]\d{9}$/.test(phone)
}

function getRoleLabel(role) {
  const labels = {
    admin: '管理员',
    principal: '校长',
    vice_principal: '德育/安全副校长',
    director: '德育处主任',
    vice_director: '德育处副主任',
    safety_head: '安全办主任',
    class_teacher: '班主任',
    psychology_teacher: '心理老师',
    instructor: '教官',
    safety_member: '安全办成员'
  }
  return labels[role] || role
}

function getOrgPath(role) {
  const paths = {
    admin: ['管理员'],
    principal: ['校长'],
    vice_principal: ['副校长'],
    director: ['副校长', '德育处', '德育处主任'],
    vice_director: ['副校长', '德育处', '德育处副主任'],
    safety_head: ['副校长', '安全办', '安全办主任'],
    class_teacher: ['副校长', '德育处', '班主任'],
    psychology_teacher: ['副校长', '德育处', '心理老师'],
    instructor: ['副校长', '德育处', '教官'],
    safety_member: ['副校长', '安全办', '安全办成员']
  }
  return paths[role] || []
}
