// cloudfunctions/student/index.js — 学生管理
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
function buildPermissionFilter(user, baseWhere = {}) {
  const where = { is_deleted: false, ...baseWhere }
  switch (user.role) {
    case 'class_teacher': where.class_id = user.class_id || '__none__'; break
    case 'principal': case 'vice_principal': case 'admin': case 'director': case 'vice_director': break
    default: where.submitter_id = user._id; break
  }
  return where
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

  try {
    const user = await getUserByOpenId(db, OPENID)
    if (!user) return fail(401, '用户未注册')

    switch (action) {
      case 'list':              return await handleList(data, user)
      case 'detail':            return await handleDetail(data, user)
      case 'create':            return await handleCreate(data, user)
      case 'update':            return await handleUpdate(data, user)
      case 'delete':            return await handleDelete(data, user)
      case 'import':            return await handleImport(data, user)
      case 'listByCategory':    return await handleListByCategory(data, user)
      case 'listOutOfSchool':   return await handleListOutOfSchool(data, user)
      default:                  return fail(400, `未知操作: ${action}`)
    }
  } catch (err) {
    console.error('[student] 错误:', err)
    return fail(500, '服务器内部错误')
  }
}

// ==================== 学生列表 ====================
async function handleList(data, user) {
  const { page = 1, pageSize = 20, classId, gradeId, keyword } = data
  const where = buildPermissionFilter(user, {})
  if (classId) where.class_id = classId
  if (gradeId) where.grade_id = gradeId
  if (keyword) where.name = db.RegExp({ regexp: keyword, options: 'i' })

  const total = await db.collection('students').where(where).count()
  const list = await db.collection('students').where(where)
    .orderBy('create_time', 'desc').skip((page - 1) * pageSize).limit(pageSize).get()

  const safeList = list.data.map(s => ({ ...s, id_card: undefined, id_card_display: s.id_card_last4 ? `**** **** **** ${s.id_card_last4}` : '****' }))
  return pageResult(safeList, total.total, page, pageSize)
}

// ==================== 学生详情 ====================
async function handleDetail(data, user) {
  const { studentId } = data
  if (!studentId) return fail(400, '学生ID不能为空')
  const result = await db.collection('students').where({ _id: studentId, is_deleted: false }).get()
  if (!result.data.length) return fail(404, '学生不存在')
  const student = result.data[0]

  if (user.role === 'class_teacher' && student.class_id !== user.class_id) {
    return fail(403, '您只能查看本班学生')
  }

  const isAdmin = ['admin', 'principal', 'vice_principal', 'director', 'vice_director'].includes(user.role)
  const studentData = { ...student, id_card_display: student.id_card_last4 ? `**** **** **** ${student.id_card_last4}` : '****' }
  if (!isAdmin) studentData.id_card = undefined
  return success(studentData)
}

// ==================== 创建学生 ====================
async function handleCreate(data, user) {
  const roleErr = requireRole(user, ['admin', 'director', 'vice_director'])
  if (roleErr) return roleErr

  const { name, gender, id_card, class_id, class_name, grade_id, grade_name, enroll_year, father_name, father_phone, mother_name, mother_phone, address, remark, ethnicity } = data
  if (!name) return fail(400, '学生姓名不能为空')
  if (!gender || !['male', 'female'].includes(gender)) return fail(400, '性别不合法')
  if (!id_card) return fail(400, '身份证号不能为空')
  if (!class_id) return fail(400, '班级不能为空')

  const hasFather = father_name && father_phone
  const hasMother = mother_name && mother_phone
  if (!hasFather && !hasMother) return fail(400, '父亲和母亲信息至少填写一组')

  const studentId = generateId('student')
  const doc = {
    _id: studentId, name, gender, ethnicity: ethnicity || '汉族',
    id_card: Buffer.from(id_card).toString('base64'),
    id_card_last4: id_card.slice(-4),
    class_id, class_name: class_name || '', grade_id: grade_id || '', grade_name: grade_name || '',
    enroll_year: enroll_year || '', tags: [],
    out_of_school_status: null, out_of_school_since: null,
    father_name: father_name || '', father_phone: father_phone || '',
    mother_name: mother_name || '', mother_phone: mother_phone || '',
    address: address || '', remark: remark || '',
    create_time: Date.now(), update_time: Date.now(), is_deleted: false
  }

  await db.collection('students').add({ data: doc })
  return success({ _id: studentId }, '学生添加成功')
}

// ==================== 更新学生 ====================
async function handleUpdate(data, user) {
  const roleErr = requireRole(user, ['admin', 'director', 'vice_director'])
  if (roleErr) return roleErr

  const { studentId, ...updateFields } = data
  if (!studentId) return fail(400, '学生ID不能为空')
  delete updateFields._id; delete updateFields.create_time; delete updateFields.tags

  if (updateFields.id_card) {
    updateFields.id_card = Buffer.from(updateFields.id_card).toString('base64')
    updateFields.id_card_last4 = updateFields.id_card.slice(-4)
  }
  updateFields.update_time = Date.now()

  await db.collection('students').doc(studentId).update({ data: updateFields })
  return success(null, '学生信息更新成功')
}

// ==================== 删除学生 ====================
async function handleDelete(data, user) {
  const roleErr = requireRole(user, ['admin'])
  if (roleErr) return roleErr
  const { studentId } = data
  if (!studentId) return fail(400, '学生ID不能为空')
  await db.collection('students').doc(studentId).update({ data: { is_deleted: true, update_time: Date.now() } })
  return success(null, '删除成功')
}

// ==================== Excel 导入 ====================
async function handleImport(data, user) {
  const roleErr = requireRole(user, ['admin', 'director', 'vice_director'])
  if (roleErr) return roleErr

  const { students: importList } = data
  if (!importList || !Array.isArray(importList) || importList.length === 0) return fail(400, '导入数据不能为空')

  let successCount = 0, failCount = 0
  const errors = []

  for (let i = 0; i < importList.length; i++) {
    const row = importList[i]
    try {
      if (!row.name || !row.id_card || !row.class_id) throw new Error('姓名/身份证号/班级不能为空')
      const studentId = generateId('student')
      await db.collection('students').add({
        data: {
          _id: studentId, name: row.name, gender: row.gender || 'male', ethnicity: row.ethnicity || '汉族',
          id_card: Buffer.from(row.id_card).toString('base64'), id_card_last4: row.id_card.slice(-4),
          class_id: row.class_id, class_name: row.class_name || '', grade_id: row.grade_id || '', grade_name: row.grade_name || '',
          enroll_year: row.enroll_year || '', tags: [], out_of_school_status: null, out_of_school_since: null,
          father_name: row.father_name || '', father_phone: row.father_phone || '',
          mother_name: row.mother_name || '', mother_phone: row.mother_phone || '',
          address: row.address || '', remark: row.remark || '',
          create_time: Date.now(), update_time: Date.now(), is_deleted: false
        }
      })
      successCount++
    } catch (err) {
      failCount++
      errors.push({ row: i + 1, name: row.name, error: err.message })
    }
  }
  return success({ total: importList.length, successCount, failCount, errors: errors.slice(0, 20) }, `导入完成：成功 ${successCount} 条，失败 ${failCount} 条`)
}

// ==================== 按分类体系筛选 ====================
async function handleListByCategory(data, user) {
  const { page = 1, pageSize = 20, system, category, classId, gradeId } = data
  const where = buildPermissionFilter(user, {})
  if (classId) where.class_id = classId
  if (gradeId) where.grade_id = gradeId

  switch (system) {
    case 'six': where['tags.category_6'] = category; break
    case 'four': where['tags.category_4'] = category; break
    case 'out_of_school':
      if (category) where['tags.category_out'] = category
      else where._ = _.or([{ 'tags.category_out': _.exists(true) }, { out_of_school_status: _.neq(null) }])
      break
    default: return fail(400, '请指定分类体系: six | four | out_of_school')
  }

  const total = await db.collection('students').where(where).count()
  const list = await db.collection('students').where(where)
    .orderBy('create_time', 'desc').skip((page - 1) * pageSize).limit(pageSize).get()

  const safeList = list.data.map(s => ({ ...s, id_card: undefined, id_card_display: s.id_card_last4 ? `**** **** **** ${s.id_card_last4}` : '****' }))
  return pageResult(safeList, total.total, page, pageSize)
}

// ==================== 在籍不在校列表 ====================
async function handleListOutOfSchool(data, user) {
  const { page = 1, pageSize = 20, status, classId } = data
  const where = buildPermissionFilter(user, {})
  if (classId) where.class_id = classId
  if (status) where.out_of_school_status = status
  else where.out_of_school_status = _.neq(null)

  const total = await db.collection('students').where(where).count()
  const list = await db.collection('students').where(where)
    .orderBy('out_of_school_since', 'desc').skip((page - 1) * pageSize).limit(pageSize).get()

  const safeList = list.data.map(s => ({ ...s, id_card: undefined, id_card_display: s.id_card_last4 ? `**** **** **** ${s.id_card_last4}` : '****' }))
  return pageResult(safeList, total.total, page, pageSize)
}
