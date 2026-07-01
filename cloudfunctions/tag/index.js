// cloudfunctions/tag/index.js — 标签提交与自动归类（核心引擎）
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
      case 'configList':        return await handleConfigList(data, user)
      case 'configCreate':      return await handleConfigCreate(data, user)
      case 'configUpdate':      return await handleConfigUpdate(data, user)
      case 'configToggle':      return await handleConfigToggle(data, user)
      case 'submit':            return await handleSubmit(data, user)
      case 'remove':            return await handleRemove(data, user)
      case 'studentTagHistory': return await handleStudentTagHistory(data, user)
      case 'categoryStats':     return await handleCategoryStats(data, user)
      default:                  return fail(400, `未知操作: ${action}`)
    }
  } catch (err) {
    console.error('[tag] 错误:', err)
    return fail(500, '服务器内部错误')
  }
}

// ==================== 标签配置列表 ====================
async function handleConfigList(data, user) {
  const { keyword } = data
  const where = {}
  if (keyword) where.name = db.RegExp({ regexp: keyword, options: 'i' })
  const list = await db.collection('config_tags').where(where).orderBy('group', 'asc').orderBy('sort_order', 'asc').get()
  return success(list.data)
}

// ==================== 标签配置创建 ====================
async function handleConfigCreate(data, user) {
  const roleErr = requireRole(user, ['admin'])
  if (roleErr) return roleErr
  const { name, group, category_6, category_4, category_out, sort_order } = data
  if (!name) return fail(400, '标签名称不能为空')
  const existing = await db.collection('config_tags').where({ name }).count()
  if (existing.total > 0) return fail(422, '标签名称已存在')

  const configId = generateId('config_tag')
  await db.collection('config_tags').add({
    data: { _id: configId, name, group: group || '其他', category_6: category_6 || '', category_4: category_4 || '', category_out: category_out || '', sort_order: sort_order || 0, is_enabled: true, create_time: Date.now(), update_time: Date.now() }
  })
  return success({ _id: configId }, '标签添加成功')
}

// ==================== 标签配置更新 ====================
async function handleConfigUpdate(data, user) {
  const roleErr = requireRole(user, ['admin'])
  if (roleErr) return roleErr
  const { configId, ...updateFields } = data
  if (!configId) return fail(400, '配置ID不能为空')
  delete updateFields._id; delete updateFields.create_time
  updateFields.update_time = Date.now()
  await db.collection('config_tags').doc(configId).update({ data: updateFields })
  return success(null, '标签更新成功')
}

// ==================== 标签启用/禁用 ====================
async function handleConfigToggle(data, user) {
  const roleErr = requireRole(user, ['admin'])
  if (roleErr) return roleErr
  const { configId, isEnabled } = data
  if (!configId) return fail(400, '配置ID不能为空')
  await db.collection('config_tags').doc(configId).update({ data: { is_enabled: isEnabled, update_time: Date.now() } })
  return success(null, isEnabled ? '标签已启用' : '标签已禁用')
}

// ==================== 提交标签（核心） ====================
async function handleSubmit(data, user) {
  const roleErr = requireRole(user, ['admin', 'director', 'vice_director', 'class_teacher'])
  if (roleErr) return roleErr

  const { studentId, tagNames, description } = data
  if (!studentId) return fail(400, '请选择学生')
  if (!tagNames || !Array.isArray(tagNames) || tagNames.length === 0) return fail(400, '请至少选择一个标签')

  const studentResult = await db.collection('students').where({ _id: studentId, is_deleted: false }).get()
  if (!studentResult.data.length) return fail(404, '学生不存在')
  const student = studentResult.data[0]

  if (user.role === 'class_teacher' && student.class_id !== user.class_id) {
    return fail(403, '您只能为本班学生添加标签')
  }

  // 获取标签映射
  const tagConfigs = await db.collection('config_tags').where({ name: _.in(tagNames), is_enabled: true }).get()
  if (tagConfigs.data.length === 0) return fail(400, '所选标签不存在或已禁用')

  const foundNames = tagConfigs.data.map(t => t.name)
  const invalidNames = tagNames.filter(n => !foundNames.includes(n))
  if (invalidNames.length > 0) return fail(400, `以下标签不存在或已禁用: ${invalidNames.join(', ')}`)

  // 过滤已存在的标签
  const now = Date.now()
  const existingTags = student.tags || []
  const existingNames = existingTags.map(t => t.name)
  const newConfigs = tagConfigs.data.filter(t => !existingNames.includes(t.name))
  if (newConfigs.length === 0) return fail(422, '所选标签已全部存在')

  const newTags = newConfigs.map(config => ({
    name: config.name,
    category_6: config.category_6 || '',
    category_4: config.category_4 || '',
    category_out: config.category_out || '',
    added_time: now
  }))
  const updatedTags = [...existingTags, ...newTags]

  // 自动计算在籍不在校状态
  let outOfSchoolStatus = student.out_of_school_status
  let outOfSchoolSince = student.out_of_school_since
  const hasOutCategory = newConfigs.some(c => c.category_out)
  if (hasOutCategory && !outOfSchoolStatus) {
    outOfSchoolStatus = 'tracking'
    outOfSchoolSince = now
  }

  // 更新学生
  const updateData = { tags: updatedTags, update_time: now }
  if (outOfSchoolStatus !== student.out_of_school_status) {
    updateData.out_of_school_status = outOfSchoolStatus
    updateData.out_of_school_since = outOfSchoolSince
  }
  await db.collection('students').doc(studentId).update({ data: updateData })

  // 写入标签提交记录
  for (const tagName of newConfigs.map(c => c.name)) {
    const recordId = generateId('tag')
    await db.collection('student_tags').add({
      data: { _id: recordId, student_id: studentId, student_name: student.name, class_id: student.class_id, tag_name: tagName, description: description || '', submitter_id: user._id, submitter_name: user.name, submitter_role: user.role, create_time: now, update_time: now, is_deleted: false }
    })
  }

  const sixCategories = [...new Set(newTags.filter(t => t.category_6).map(t => t.category_6))]
  const fourCategories = [...new Set(newTags.filter(t => t.category_4).map(t => t.category_4))]
  const outCategoriesResult = [...new Set(newTags.filter(t => t.category_out).map(t => t.category_out))]

  return success({
    studentId,
    addedTags: newTags.map(t => t.name),
    skippedTags: tagNames.filter(n => existingNames.includes(n)),
    classification: { six: sixCategories, four: fourCategories, out_of_school: outCategoriesResult },
    outOfSchoolStatus
  }, `成功添加 ${newTags.length} 个标签`)
}

// ==================== 移除标签 ====================
async function handleRemove(data, user) {
  const roleErr = requireRole(user, ['admin', 'director', 'vice_director', 'class_teacher'])
  if (roleErr) return roleErr
  const { studentId, tagName } = data
  if (!studentId || !tagName) return fail(400, '学生ID和标签名不能为空')

  const studentResult = await db.collection('students').where({ _id: studentId, is_deleted: false }).get()
  if (!studentResult.data.length) return fail(404, '学生不存在')
  const student = studentResult.data[0]
  if (user.role === 'class_teacher' && student.class_id !== user.class_id) return fail(403, '您只能操作本班学生')

  const updatedTags = (student.tags || []).filter(t => t.name !== tagName)
  const hasOutTag = updatedTags.some(t => t.category_out)
  const updateData = { tags: updatedTags, update_time: Date.now() }
  if (!hasOutTag && student.out_of_school_status) {
    updateData.out_of_school_status = null
    updateData.out_of_school_since = null
  }
  await db.collection('students').doc(studentId).update({ data: updateData })
  return success(null, '标签已移除')
}

// ==================== 学生标签历史 ====================
async function handleStudentTagHistory(data, user) {
  const { studentId, page = 1, pageSize = 20 } = data
  if (!studentId) return fail(400, '学生ID不能为空')
  const where = { student_id: studentId, is_deleted: false }
  const total = await db.collection('student_tags').where(where).count()
  const list = await db.collection('student_tags').where(where).orderBy('create_time', 'desc').skip((page - 1) * pageSize).limit(pageSize).get()
  return pageResult(list.data, total.total, page, pageSize)
}

// ==================== 分类统计 ====================
async function handleCategoryStats(data, user) {
  const { classId, gradeId } = data
  const where = { is_deleted: false }
  if (classId) where.class_id = classId
  if (gradeId) where.grade_id = gradeId

  const students = await db.collection('students').where(where).field({ tags: true, out_of_school_status: true, class_id: true, grade_id: true }).get()

  const stats = { six: {}, four: {}, outOfSchool: {} }
  for (const s of students.data) {
    const tags = s.tags || []
    const sixSet = new Set(tags.filter(t => t.category_6).map(t => t.category_6))
    sixSet.forEach(cat => { stats.six[cat] = (stats.six[cat] || 0) + 1 })
    const fourSet = new Set(tags.filter(t => t.category_4).map(t => t.category_4))
    fourSet.forEach(cat => { stats.four[cat] = (stats.four[cat] || 0) + 1 })
    const outSet = new Set(tags.filter(t => t.category_out).map(t => t.category_out))
    outSet.forEach(cat => { stats.outOfSchool[cat] = (stats.outOfSchool[cat] || 0) + 1 })
  }
  return success(stats)
}
