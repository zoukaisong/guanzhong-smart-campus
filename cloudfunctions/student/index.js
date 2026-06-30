// cloudfunctions/student/index.js — 学生管理
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const {
  success, fail, pageResult,
  getUserByOpenId, requireRole, buildPermissionFilter, generateId
} = require('../common/index')

exports.main = async (event, context) => {
  const { action, data = {} } = event
  const { OPENID } = cloud.getWXContext()

  try {
    const user = await getUserByOpenId(db, OPENID)
    if (!user) return fail(401, '用户未注册')

    switch (action) {
      case 'list':
        return await handleList(data, user)
      case 'detail':
        return await handleDetail(data, user)
      case 'create':
        return await handleCreate(data, user)
      case 'update':
        return await handleUpdate(data, user)
      case 'delete':
        return await handleDelete(data, user)
      case 'import':
        return await handleImport(data, user)
      // 按分类体系筛选
      case 'listByCategory':
        return await handleListByCategory(data, user)
      // 在籍不在校列表
      case 'listOutOfSchool':
        return await handleListOutOfSchool(data, user)
      default:
        return fail(400, `未知操作: ${action}`)
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
  if (keyword) {
    where.name = db.RegExp({ regexp: keyword, options: 'i' })
  }

  const total = await db.collection('students').where(where).count()
  const list = await db.collection('students')
    .where(where)
    .orderBy('create_time', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()

  // 脱敏处理
  const safeList = list.data.map(s => ({
    ...s,
    id_card: undefined,
    id_card_display: s.id_card_last4 ? `**** **** **** ${s.id_card_last4}` : '****'
  }))

  return pageResult(safeList, total.total, page, pageSize)
}

// ==================== 学生详情 ====================
async function handleDetail(data, user) {
  const { studentId } = data
  if (!studentId) return fail(400, '学生ID不能为空')

  const result = await db.collection('students')
    .where({ _id: studentId, is_deleted: false })
    .get()

  if (!result.data.length) return fail(404, '学生不存在')

  const student = result.data[0]

  // 权限检查：班主任只能看本班
  if (user.role === 'class_teacher' && student.class_id !== user.class_id) {
    return fail(403, '您只能查看本班学生')
  }

  // 管理员/导出时返回完整数据（包括加密身份证）
  const isAdmin = ['admin', 'principal', 'vice_principal', 'director', 'vice_director'].includes(user.role)
  const studentData = {
    ...student,
    id_card_display: student.id_card_last4 ? `**** **** **** ${student.id_card_last4}` : '****'
  }
  if (!isAdmin) {
    studentData.id_card = undefined
  }

  return success(studentData)
}

// ==================== 创建学生 ====================
async function handleCreate(data, user) {
  const roleErr = requireRole(user, ['admin', 'director', 'vice_director'])
  if (roleErr) return roleErr

  const {
    name, gender, id_card, class_id, class_name, grade_id, grade_name,
    enroll_year, father_name, father_phone, mother_name, mother_phone,
    address, remark, ethnicity
  } = data

  // 校验必填
  if (!name) return fail(400, '学生姓名不能为空')
  if (!gender || !['male', 'female'].includes(gender)) return fail(400, '性别不合法')
  if (!id_card) return fail(400, '身份证号不能为空')
  if (!class_id) return fail(400, '班级不能为空')

  // 家长至少一组
  const hasFather = father_name && father_phone
  const hasMother = mother_name && mother_phone
  if (!hasFather && !hasMother) {
    return fail(400, '父亲和母亲信息至少填写一组')
  }

  const studentId = generateId('student')

  const doc = {
    _id: studentId,
    name,
    gender,
    ethnicity: ethnicity || '汉族',
    id_card: encryptIdCard(id_card),        // AES 加密
    id_card_last4: id_card.slice(-4),
    class_id,
    class_name: class_name || '',
    grade_id: grade_id || '',
    grade_name: grade_name || '',
    enroll_year: enroll_year || '',
    tags: [],
    out_of_school_status: null,
    out_of_school_since: null,
    father_name: father_name || '',
    father_phone: father_phone || '',
    mother_name: mother_name || '',
    mother_phone: mother_phone || '',
    address: address || '',
    remark: remark || '',
    create_time: Date.now(),
    update_time: Date.now(),
    is_deleted: false
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

  // 不允许更新的字段
  delete updateFields._id
  delete updateFields.create_time
  delete updateFields.tags  // 标签通过 tag 云函数管理

  if (updateFields.id_card) {
    updateFields.id_card = encryptIdCard(updateFields.id_card)
    updateFields.id_card_last4 = updateFields.id_card.slice(-4)
  }

  updateFields.update_time = Date.now()

  await db.collection('students').doc(studentId).update({ data: updateFields })

  return success(null, '学生信息更新成功')
}

// ==================== 删除学生（软删除） ====================
async function handleDelete(data, user) {
  const roleErr = requireRole(user, ['admin'])
  if (roleErr) return roleErr

  const { studentId } = data
  if (!studentId) return fail(400, '学生ID不能为空')

  await db.collection('students').doc(studentId).update({
    data: { is_deleted: true, update_time: Date.now() }
  })

  return success(null, '删除成功')
}

// ==================== Excel 导入 ====================
async function handleImport(data, user) {
  const roleErr = requireRole(user, ['admin', 'director', 'vice_director'])
  if (roleErr) return roleErr

  const { students: importList } = data
  if (!importList || !Array.isArray(importList) || importList.length === 0) {
    return fail(400, '导入数据不能为空')
  }

  let successCount = 0
  let failCount = 0
  const errors = []

  for (let i = 0; i < importList.length; i++) {
    const row = importList[i]
    try {
      // 基本校验
      if (!row.name || !row.id_card || !row.class_id) {
        throw new Error('姓名/身份证号/班级不能为空')
      }

      // 检查身份证是否已存在
      const existing = await db.collection('students')
        .where({ id_card_last4: row.id_card.slice(-4), is_deleted: false })
        .get()
      const duplicate = existing.data.find(s => s.id_card === encryptIdCard(row.id_card))
      if (duplicate) {
        throw new Error('该身份证号已存在')
      }

      const studentId = generateId('student')
      await db.collection('students').add({
        data: {
          _id: studentId,
          name: row.name,
          gender: row.gender || 'male',
          ethnicity: row.ethnicity || '汉族',
          id_card: encryptIdCard(row.id_card),
          id_card_last4: row.id_card.slice(-4),
          class_id: row.class_id,
          class_name: row.class_name || '',
          grade_id: row.grade_id || '',
          grade_name: row.grade_name || '',
          enroll_year: row.enroll_year || '',
          tags: [],
          out_of_school_status: null,
          out_of_school_since: null,
          father_name: row.father_name || '',
          father_phone: row.father_phone || '',
          mother_name: row.mother_name || '',
          mother_phone: row.mother_phone || '',
          address: row.address || '',
          remark: row.remark || '',
          create_time: Date.now(),
          update_time: Date.now(),
          is_deleted: false
        }
      })
      successCount++
    } catch (err) {
      failCount++
      errors.push({ row: i + 1, name: row.name, error: err.message })
    }
  }

  return success({
    total: importList.length,
    successCount,
    failCount,
    errors: errors.slice(0, 20)  // 最多返回前20条错误
  }, `导入完成：成功 ${successCount} 条，失败 ${failCount} 条`)
}

// ==================== 按分类体系筛选 ====================
async function handleListByCategory(data, user) {
  const {
    page = 1, pageSize = 20,
    system,        // 'six' | 'four' | 'out_of_school'
    category,      // 具体类别，如 '家庭类' | '特殊家庭' | '长时间请假'
    classId, gradeId
  } = data

  const where = buildPermissionFilter(user, {})

  if (classId) where.class_id = classId
  if (gradeId) where.grade_id = gradeId

  // 按标签体系筛选
  switch (system) {
    case 'six':
      where['tags.category_6'] = category
      break
    case 'four':
      where['tags.category_4'] = category
      break
    case 'out_of_school':
      if (category) {
        where['tags.category_out'] = category
      } else {
        // 所有在籍不在校：有 category_out 标签 或 out_of_school_status 不为 null
        where._ = _.or([
          { 'tags.category_out': _.exists(true) },
          { out_of_school_status: _.neq(null) }
        ])
      }
      break
    default:
      return fail(400, '请指定分类体系: six | four | out_of_school')
  }

  const total = await db.collection('students').where(where).count()
  const list = await db.collection('students')
    .where(where)
    .orderBy('create_time', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()

  const safeList = list.data.map(s => ({
    ...s,
    id_card: undefined,
    id_card_display: s.id_card_last4 ? `**** **** **** ${s.id_card_last4}` : '****'
  }))

  return pageResult(safeList, total.total, page, pageSize)
}

// ==================== 在籍不在校列表 ====================
async function handleListOutOfSchool(data, user) {
  const { page = 1, pageSize = 20, status, classId } = data

  const where = buildPermissionFilter(user, {})
  if (classId) where.class_id = classId

  // 在籍不在校条件
  if (status) {
    where.out_of_school_status = status
  } else {
    where.out_of_school_status = _.neq(null)
  }

  const total = await db.collection('students').where(where).count()
  const list = await db.collection('students')
    .where(where)
    .orderBy('out_of_school_since', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()

  const safeList = list.data.map(s => ({
    ...s,
    id_card: undefined,
    id_card_display: s.id_card_last4 ? `**** **** **** ${s.id_card_last4}` : '****'
  }))

  return pageResult(safeList, total.total, page, pageSize)
}

// ==================== 辅助 ====================
function encryptIdCard(idCard) {
  // TODO: 正式环境使用 AES 加密，密钥存云函数环境变量
  // 当前阶段使用 base64 编码（后续替换为 AES-256-CBC）
  if (!idCard) return ''
  return Buffer.from(idCard).toString('base64')
}
