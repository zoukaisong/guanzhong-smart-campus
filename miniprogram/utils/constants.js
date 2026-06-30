// utils/constants.js — 全局常量定义

// ==================== 用户角色 ====================
const USER_ROLES = {
  ADMIN: 'admin',
  PRINCIPAL: 'principal',
  VICE_PRINCIPAL: 'vice_principal',
  DIRECTOR: 'director',
  VICE_DIRECTOR: 'vice_director',
  SAFETY_HEAD: 'safety_head',
  CLASS_TEACHER: 'class_teacher',
  PSYCHOLOGY_TEACHER: 'psychology_teacher',
  INSTRUCTOR: 'instructor',
  SAFETY_MEMBER: 'safety_member'
}

// 角色中文映射
const ROLE_LABELS = {
  [USER_ROLES.ADMIN]: '管理员',
  [USER_ROLES.PRINCIPAL]: '校长',
  [USER_ROLES.VICE_PRINCIPAL]: '德育/安全副校长',
  [USER_ROLES.DIRECTOR]: '德育处主任',
  [USER_ROLES.VICE_DIRECTOR]: '德育处副主任',
  [USER_ROLES.SAFETY_HEAD]: '安全办主任',
  [USER_ROLES.CLASS_TEACHER]: '班主任',
  [USER_ROLES.PSYCHOLOGY_TEACHER]: '心理老师',
  [USER_ROLES.INSTRUCTOR]: '教官',
  [USER_ROLES.SAFETY_MEMBER]: '安全办成员'
}

// ==================== 违纪处理状态 ====================
const DISCIPLINE_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  APPROVED: 'approved',
  CLOSED: 'closed'
}

const DISCIPLINE_STATUS_LABELS = {
  pending: '待审核',
  processing: '处理中',
  approved: '已审核',
  closed: '已结案'
}

// ==================== 处分状态 ====================
const PUNISH_STATUS = {
  ACTIVE: 'active',
  DOWNGRADED: 'downgraded',
  REVOKED: 'revoked'
}

const PUNISH_STATUS_LABELS = {
  active: '生效中',
  downgraded: '已降级',
  revoked: '已撤销'
}

// ==================== 违禁品状态 ====================
const CONTRABAND_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  STORED: 'stored',
  RETURNED: 'returned'
}

const CONTRABAND_STATUS_LABELS = {
  pending: '待审核',
  approved: '审核通过',
  rejected: '已驳回',
  stored: '已入柜',
  returned: '已领取'
}

// ==================== 安全教育完成状态 ====================
const SAFETY_FEEDBACK_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  OVERDUE: 'overdue'
}

// ==================== 在籍不在校状态 ====================
const OUT_OF_SCHOOL_STATUS = {
  TRACKING: 'tracking',
  PERSUADING: 'persuading',
  VISITING: 'visiting',
  RETURNED: 'returned',
  CONFIRMED: 'confirmed'
}

const OUT_OF_SCHOOL_STATUS_LABELS = {
  tracking: '跟踪中',
  persuading: '劝学中',
  visiting: '家访中',
  returned: '已返校',
  confirmed: '已确认'
}

// ==================== 在籍不在校归类 ====================
const OUT_OF_SCHOOL_CATEGORIES = {
  LONG_LEAVE: '长时间请假',
  SUSPECTED_DROPOUT: '疑似辍学',
  SUSPENDED: '休学',
  REFORM_SCHOOL: '工读学校',
  SPECIAL_SCHOOL: '特殊学校',
  BORROWING: '借读'
}

// ==================== 六类归类 ====================
const SIX_CATEGORIES = {
  FAMILY: '家庭类',
  INTERNET: '网瘾类',
  PSYCHOLOGICAL: '心理类',
  DROPOUT: '休学辍学类',
  PHYSICAL: '身体类',
  OTHER: '其他类'
}

// ==================== 四特归类 ====================
const FOUR_SPECIAL_CATEGORIES = {
  SPECIAL_FAMILY: '特殊家庭',
  SPECIAL_PHYSIQUE: '特异体质',
  SPECIAL_BEHAVIOR: '特殊行为',
  SPECIAL_PSYCHOLOGY: '特异心理'
}

// ==================== 违纪类型 ====================
const DISCIPLINE_TYPES = {
  VIOLATION: 'violation',
  PUNISHMENT: 'punishment'
}

// 处分等级
const PUNISHMENT_LEVELS = {
  1: '警告',
  2: '严重警告',
  3: '记过',
  4: '留校察看'
}

// ==================== 用户审核状态 ====================
const USER_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected'
}

// ==================== 云函数名映射 ====================
const CLOUD_FUNCTIONS = {
  AUTH: 'auth',
  USER: 'user',
  STUDENT: 'student',
  TAG: 'tag',
  DISCIPLINE: 'discipline',
  SAFETY: 'safety',
  CONTRABAND: 'contraband',
  PATROL: 'patrol',
  MORAL: 'moral',
  EXPORT: 'export',
  SCHEDULE: 'schedule',
  COMMON: 'common'
}

// ==================== 分页默认值 ====================
const PAGE_DEFAULTS = {
  PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100
}

// ==================== 图片上传限制 ====================
const UPLOAD_LIMITS = {
  MAX_PHOTO_COUNT: 3,
  MAX_PHOTO_SIZE: 10 * 1024 * 1024  // 10MB
}

// ==================== 学期 ====================
const SEMESTER_FORMAT = /^\d{4}-\d{4}-[12]$/

module.exports = {
  USER_ROLES,
  ROLE_LABELS,
  DISCIPLINE_STATUS,
  DISCIPLINE_STATUS_LABELS,
  PUNISH_STATUS,
  PUNISH_STATUS_LABELS,
  CONTRABAND_STATUS,
  CONTRABAND_STATUS_LABELS,
  SAFETY_FEEDBACK_STATUS,
  OUT_OF_SCHOOL_STATUS,
  OUT_OF_SCHOOL_STATUS_LABELS,
  OUT_OF_SCHOOL_CATEGORIES,
  SIX_CATEGORIES,
  FOUR_SPECIAL_CATEGORIES,
  DISCIPLINE_TYPES,
  PUNISHMENT_LEVELS,
  USER_STATUS,
  CLOUD_FUNCTIONS,
  PAGE_DEFAULTS,
  UPLOAD_LIMITS,
  SEMESTER_FORMAT
}
