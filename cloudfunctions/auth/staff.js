// cloudfunctions/auth/staff.js — 关口中学教职工名单匹配表
// 根据手机号匹配姓名、职位、班级

// 班级→年级映射
function getGradeInfo(className) {
  const prefix = className.substring(0, 2)
  if (prefix === '25') return { grade_id: 'grade_7', grade_name: '七年级', enroll_year: '2025' }
  if (prefix === '24') return { grade_id: 'grade_8', grade_name: '八年级', enroll_year: '2024' }
  if (prefix === '23') return { grade_id: 'grade_9', grade_name: '九年级', enroll_year: '2023' }
  return {}
}

// 教职工名单：phone → { name, position, class_id, class_name, grade_id, grade_name }
const STAFF_MAP = {
  '13974904721': { name: '李程雁', position: '校长' },
  '13875862797': { name: '王晓冰', position: '德育安全副校长' },
  '15084919991': { name: '邹开松', position: '德育处主任' },
  '13974979063': { name: '张端敏', position: '安全办主任' },
  '15200815401': { name: '谢仁杰', position: '德育处副主任' },
  '13548758082': { name: '蓝思嘉', position: '安全办成员' },
  '18711161886': { name: '周婵媛', position: '心理老师' },
  '15111472681': { name: '郭平', position: '心理老师' },
  '15974186031': { name: '张银化', position: '教官' },
  '17689238828': { name: '熊建国', position: '教官' },
  '17738091997': { name: '刘浪', position: '教官' },
  '18100737286': { name: '张兆帅', position: '教官' },
  '13755183825': { name: '吴政星', position: '教官' },
  '18569053283': { name: '吉浪蛟', position: '教官' },
  '15084991784': { name: '林丽', position: '教官' },
  '15974157927': { name: '周雪妤', position: '2301班班主任', class_name: '2301班' },
  '18142638038': { name: '周美玲', position: '2302班班主任', class_name: '2302班' },
  '18508482517': { name: '张红日', position: '2303班班主任', class_name: '2303班' },
  '15773120999': { name: '鲁思思', position: '2304班班主任', class_name: '2304班' },
  '13807319049': { name: '周张文', position: '2305班班主任', class_name: '2305班' },
  '18973166543': { name: '张颖', position: '2306班班主任', class_name: '2306班' },
  '13677345163': { name: '杨琦', position: '2307班班主任', class_name: '2307班' },
  '15575810506': { name: '梅润玉', position: '2308班班主任', class_name: '2308班' },
  '18874758876': { name: '厉牡', position: '2309班班主任', class_name: '2309班' },
  '13874998819': { name: '周英根', position: '2310班班主任', class_name: '2310班' },
  '13786173065': { name: '何倩', position: '2311班班主任', class_name: '2311班' },
  '18607467292': { name: '蒋文娟', position: '2312班班主任', class_name: '2312班' },
  '13637423459': { name: '李美玲', position: '2401班班主任', class_name: '2401班' },
  '18861649936': { name: '黄艳', position: '2402班班主任', class_name: '2402班' },
  '18774829828': { name: '张世民', position: '2403班班主任', class_name: '2403班' },
  '18216049743': { name: '刘盼', position: '2404班班主任', class_name: '2404班' },
  '18390950172': { name: '何心芬', position: '2405班班主任', class_name: '2405班' },
  '18774051001': { name: '胡欢', position: '2406班班主任', class_name: '2406班' },
  '13907497602': { name: '童和', position: '2407班班主任', class_name: '2407班' },
  '15607475227': { name: '李艳', position: '2408班班主任', class_name: '2408班' },
  '17872313248': { name: '张婷', position: '2409班班主任', class_name: '2409班' },
  '13657431131': { name: '李涵芬', position: '2410班班主任', class_name: '2410班' },
  '18890371939': { name: '张丹', position: '2411班班主任', class_name: '2411班' },
  '18373585890': { name: '邱莎', position: '2412班班主任', class_name: '2412班' },
  '15674296293': { name: '甘婷', position: '2413班班主任', class_name: '2413班' },
  '18774961474': { name: '徐贞贞', position: '2501班班主任', class_name: '2501班' },
  '13618471375': { name: '谭应昭', position: '2502班班主任', class_name: '2502班' },
  '13786211810': { name: '唐婷', position: '2503班班主任', class_name: '2503班' },
  '18974852732': { name: '徐怡文', position: '2504班班主任', class_name: '2504班' },
  '15084887411': { name: '吴婷', position: '2505班班主任', class_name: '2505班' },
  '15200514037': { name: '周露', position: '2506班班主任', class_name: '2506班' },
  '18274982653': { name: '王淼', position: '2507班班主任', class_name: '2507班' },
  '13467683226': { name: '张洁', position: '2508班班主任', class_name: '2508班' },
  '16673160229': { name: '张芷琳', position: '2509班班主任', class_name: '2509班' },
  '18773118453': { name: '邱婷', position: '2510班班主任', class_name: '2510班' },
  '18390805120': { name: '张瑶林', position: '2511班班主任', class_name: '2511班' },
  '13548534246': { name: '寻丹', position: '2512班班主任', class_name: '2512班' },
  '13677309655': { name: '李骞', position: '2513班班主任', class_name: '2513班' }
}

// 为每个班主任计算班级ID和年级信息
for (const phone of Object.keys(STAFF_MAP)) {
  const entry = STAFF_MAP[phone]
  if (entry.class_name) {
    const classId = 'class_' + entry.class_name.replace('班', '')
    const grade = getGradeInfo(entry.class_name)
    entry.class_id = classId
    entry.grade_id = grade.grade_id || ''
    entry.grade_name = grade.grade_name || ''
  }
}

/**
 * 根据手机号查找教职工
 * @param {string} phone - 手机号
 * @returns {Object|null} { name, position, class_id, class_name, grade_id, grade_name } 或 null
 */
function matchStaff(phone) {
  return STAFF_MAP[phone] || null
}

/**
 * 判断职位是否是班主任
 * @param {string} position - 职位
 * @returns {boolean}
 */
function isClassTeacherPosition(position) {
  return position && position.includes('班主任')
}

module.exports = { matchStaff, isClassTeacherPosition }
