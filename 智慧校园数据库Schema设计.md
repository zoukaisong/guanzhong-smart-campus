# 智慧校园 — 云数据库 Schema 设计

> **版本**: v1.0  
> **日期**: 2026-06-22  
> **数据库**: 微信云开发 云数据库（NoSQL / MongoDB 兼容）  
> **关联文档**: 需求文档 v1.8.1 / 开发规范 v1.0

---

## 设计决策（已确认）

| # | 决策 | 结论 |
|:---:|------|------|
| 1 | 标签存储 | 学生文档存 tags 数组 + student_tags 集合存提交历史 |
| 2 | ID 策略 | 自定义有意义 ID，格式 `{前缀}_{年月日}{序号}` |
| 3 | 冗余 | class_name、grade_name 冗余；teacher_name 不冗余 |
| 4 | 操作日志 | 只记 CUD + 审核/结案/导出，查询不记 |
| 5 | 删除策略 | 学生/违纪/标签 软删除；计划/临时照片 可硬删除 |
| 6 | 数据分区 | 不分表；所有时间关联集合加 `semester` 字段；通过复合索引 + 归档集合管理历史数据 |

---

## 目录

1. [集合总览](#1-集合总览)
2. [核心业务集合](#2-核心业务集合)
3. [日志与配置集合](#3-日志与配置集合)
4. [索引设计](#4-索引设计)
5. [数据归档策略](#5-数据归档策略)
6. [集合关系图](#6-集合关系图)

---

## 1. 集合总览

| # | 集合名 | 说明 | 删除策略 |
|:---:|------|------|:---:|
| 1 | `users` | 用户表 | 软删除 |
| 2 | `students` | 学生表 | 软删除 |
| 3 | `grades` | 年级表 | 可硬删 |
| 4 | `classes` | 班级表 | 软删除 |
| 5 | `student_tags` | 标签提交记录 | 软删除 |
| 6 | `discipline_records` | 违纪记录 | 软删除 |
| 7 | `talk_records` | 谈心谈话记录 | 软删除 |
| 8 | `visit_records` | 家访记录 | 软删除 |
| 9 | `persuasion_records` | 劝学记录 | 软删除 |
| 10 | `safety_plans` | 安全教育周计划 | 可硬删 |
| 11 | `safety_feedbacks` | 安全教育完成反馈 | 软删除 |
| 12 | `safety_activities` | 自主安全教育活动 | 软删除 |
| 13 | `moral_activities` | 德育活动记录 | 软删除 |
| 14 | `contraband_records` | 违禁品记录 | 软删除 |
| 15 | `patrol_checkins` | 巡逻打卡记录 | 软删除 |
| 16 | `patrol_locations` | 打卡位置配置 | 可硬删 |
| 17 | `safety_events` | 安全事件记录 | 软删除 |
| 18 | `operation_logs` | 操作日志 | 不删（归档） |
| 19 | `config_tags` | 标签映射配置 | 可硬删 |
| 20 | `config_contraband_types` | 违禁品类型配置 | 可硬删 |
| 21 | `config_semester` | 学期配置 | 可硬删 |

---

## 2. 核心业务集合

### 2.1 users（用户表）

```js
{
  _id: 'user_20230601001',          // String，自定义 ID
  openid: 'oXXXX...',               // String，微信 openid，唯一索引
  name: '张三',                      // String，真实姓名
  phone: '13800138000',             // String，手机号
  role: 'class_teacher',            // String，枚举见 USER_ROLES
  role_label: '班主任',              // String，冗余角色中文名
  org_path: ['德育处', '班主任'],    // Array，组织路径，便于权限判断

  // ---- 班主任专用 ----
  class_id: 'class_2301',           // String，所带班级 ID
  class_name: '2301班',             // String，冗余班级名称
  grade_id: 'grade_7',              // String，冗余年级 ID

  // ---- 心理老师专用 ----
  // 无额外字段，通过 role 判断数据范围

  // ---- 状态 ----
  status: 'approved',               // String，pending | approved | rejected
  approved_by: 'user_admin001',     // String，审核人 ID
  approved_time: 1719000000000,     // Number，审核时间戳

  // ---- 通用 ----
  create_time: 1719000000000,       // Number，注册时间戳
  update_time: 1719000000000,       // Number，更新时间戳
  is_deleted: false                 // Boolean，软删除
}
```

**角色枚举**：

| role 值 | 中文 | org_path 示例 |
|------|------|------|
| `admin` | 管理员 | `['管理员']` |
| `principal` | 校长 | `['校长']` |
| `vice_principal` | 德育/安全副校长 | `['副校长']` |
| `director` | 德育处主任 | `['副校长', '德育处', '德育处主任']` |
| `vice_director` | 德育处副主任 | `['副校长', '德育处', '德育处副主任']` |
| `safety_head` | 安全办主任 | `['副校长', '安全办', '安全办主任']` |
| `class_teacher` | 班主任 | `['副校长', '德育处', '班主任']` |
| `psychology_teacher` | 心理老师 | `['副校长', '德育处', '心理老师']` |
| `instructor` | 教官 | `['副校长', '德育处', '教官']` |
| `safety_member` | 安全办成员 | `['副校长', '安全办', '安全办成员']` |

---

### 2.2 students（学生表）

```js
{
  _id: 'student_20230601001',       // String，自定义 ID

  // ---- 基本信息 ----
  name: '张三',                      // String
  gender: 'male',                   // String，male | female
  ethnicity: '汉族',                // String，民族
  id_card: 'encrypted_xxx',         // String，AES 加密存储
  id_card_last4: '1234',            // String，明文后四位，列表展示用

  // ---- 年级/班级（冗余策略） ----
  class_id: 'class_2301',           // String，关联 classes
  class_name: '2301班',             // String，冗余
  grade_id: 'grade_7',              // String，关联 grades
  grade_name: '七年级',             // String，冗余
  enroll_year: '2023',             // String，入学年份

  // ---- 标签（A+B 结合） ----
  tags: [                           // Array，当前有效标签列表（冗余于学生文档）
    {
      name: '单亲家庭',              // 标签名
      category_6: '家庭类',          // 六类归类
      category_4: '特殊家庭',        // 四特归类
      category_out: '',             // 在籍不在校归类（可空）
      added_time: 1719000000000     // 添加时间
    }
  ],

  // ---- 在籍不在校状态 ----
  out_of_school_status: 'tracking',  // String，null=正常 | tracking | persuading | visiting | returned | confirmed
  out_of_school_since: 1719000000000, // Number，进入异常状态的起始时间

  // ---- 家长信息（至少一组） ----
  father_name: '张父',               // String
  father_phone: '13800138000',      // String
  mother_name: '',                  // String（可与父亲信息互补，至少一组不为空）
  mother_phone: '',                 // String

  // ---- 家庭地址 ----
  address: 'XX省XX市XX区XX路XX号',  // String

  // ---- 备注 ----
  remark: '',                       // String

  // ---- 通用 ----
  create_time: 1719000000000,
  update_time: 1719000000000,
  is_deleted: false                 // 毕业/转学后标记 true
}
```

---

### 2.3 grades（年级表）

```js
{
  _id: 'grade_7',                   // String，grade_7 | grade_8 | grade_9 | grade_graduated
  name: '七年级',                    // String
  sort_order: 1,                    // Number，排序
  create_time: 1719000000000,
  update_time: 1719000000000
}
```

### 2.4 classes（班级表）

```js
{
  _id: 'class_2301',                // String，class_{年份}{序号}
  name: '2301班',                   // String
  grade_id: 'grade_7',              // String
  grade_name: '七年级',             // String，冗余
  teacher_id: 'user_xxx',           // String，当前班主任 ID
  teacher_name: '李老师',            // String，冗余班主任姓名
  sort_order: 1,                    // Number
  create_time: 1719000000000,
  update_time: 1719000000000,
  is_deleted: false
}
```

---

### 2.5 student_tags（标签提交记录）

```js
{
  _id: 'tag_20240622001',           // String
  student_id: 'student_20230601001',// String
  student_name: '张三',             // String，冗余
  class_id: 'class_2301',           // String
  tag_name: '单亲家庭',              // String
  description: '父母离异，跟随父亲生活',  // String，提交时补充说明
  submitter_id: 'user_xxx',         // String
  submitter_name: '李老师',          // String
  submitter_role: 'class_teacher',  // String
  create_time: 1719000000000,
  update_time: 1719000000000,
  is_deleted: false
}
```

---

### 2.6 discipline_records（违纪记录）

```js
{
  _id: 'discipline_20240622001',    // String

  // ---- 学期 ----
  semester: '2024-2025-1',            // String，所属学期

  // ---- 关联学生 ----
  student_id: 'student_20230601001',
  student_name: '张三',
  class_id: 'class_2301',
  class_name: '2301班',

  // ---- 违纪信息 ----
  type: 'punishment',               // String，violation（普通违纪）| punishment（处分）
  level: 1,                         // Number，处分等级 1警告 2严重警告 3记过 4留校察看；普通违纪为 0
  level_label: '警告',              // String，冗余中文
  date: '2024-06-22',              // String，违纪发生日期
  location: '教室',                  // String，发生地点
  detail: '上课期间玩手机',           // String，违纪详情
  detail_photos: [                  // Array，拍照图片 fileID
    'cloud://xxx.jpg'
  ],

  // ---- 惩戒措施 ----
  penalty_type: 'suspend_dorm',      // String，none | suspend_dorm（停宿）| suspend_school（停学）
  penalty_days: 3,                   // Number，惩戒天数

  // ---- 处理过程 ----
  process_notes: '已与学生谈话教育',   // String，教官/班主任填写的处理经过
  process_photos: [],                 // Array，处理过程附件

  // ---- 结果 ----
  result: '学生已认识到错误',          // String，处理结果

  // ---- 状态（状态机） ----
  status: 'pending',                  // String，pending | processing | approved | closed
  punish_status: 'active',            // String，active | downgraded | revoked（仅处分类型）
  punish_downgrade_to: null,          // Number，降级到哪个等级
  punish_downgrade_reason: '',        // String，降级/撤销依据（文字）
  punish_downgrade_photos: [],        // Array，降级/撤销依据（图片）

  // ---- 人员 ----
  submitter_id: 'user_xxx',           // String，提交人
  submitter_name: '李老师',
  submitter_role: 'class_teacher',
  handler_id: 'user_yyy',             // String，教官处理人
  handler_name: '王教官',
  approver_id: 'user_zzz',            // String，审核人（德育处主任）
  approver_name: '赵主任',

  // ---- 时间 ----
  create_time: 1719000000000,
  update_time: 1719000000000,
  close_time: null,                   // Number，结案时间
  is_deleted: false
}
```

---

### 2.7 talk_records（谈心谈话记录）

```js
{
  _id: 'talk_20240622001',
  student_id: 'student_20230601001',
  student_name: '张三',
  class_id: 'class_2301',
  class_name: '2301班',
  semester: '2024-2025-1',            // String，所属学期
  talk_date: '2024-06-22',           // String，谈话日期
  talk_time: '14:30',                // String，谈话时间
  talk_location: '心理咨询室',        // String
  content: '学生表示最近压力较大...',  // String
  assessment: '情绪低落，需持续关注',  // String，学生状态评估
  follow_up_plan: '两周后再次面谈',   // String，后续跟进计划
  next_follow_up_date: '2024-07-06', // String，下次跟进日期
  photos: [],                         // Array，附件图片
  teacher_id: 'user_xxx',             // String
  teacher_name: '孙老师',
  create_time: 1719000000000,
  update_time: 1719000000000,
  is_deleted: false
}
```

---

### 2.8 visit_records（家访记录）

```js
{
  _id: 'visit_20240622001',
  student_id: 'student_20230601001',
  student_name: '张三',
  class_id: 'class_2301',
  semester: '2024-2025-1',            // String，学期标识
  visit_date: '2024-06-22',          // String
  visitor_id: 'user_xxx',            // String
  visitor_name: '李老师',
  visitor_role: 'class_teacher',
  method: 'home',                     // String，home（上门）| phone | online
  target: '张父',                     // String，家访对象
  content: '汇报学生在校情况...',     // String
  student_status: '学生近期情绪稳定',  // String，学生近况
  persuade_result: 'returned',        // String，returned | not_returned | parent_refused
  follow_up_plan: '继续观察',         // String
  photos: [],                         // Array
  create_time: 1719000000000,
  update_time: 1719000000000,
  is_deleted: false
}
```

---

### 2.9 persuasion_records（劝学记录）

```js
{
  _id: 'persuasion_20240622001',
  student_id: 'student_20230601001',
  student_name: '张三',
  class_id: 'class_2301',
  semester: '2024-2025-1',             // String，所属学期
  persuasion_date: '2024-06-22',      // String
  method: 'phone',                     // String，phone | home | online
  target: 'both',                      // String，student | parent | both
  content: '劝说学生返校...',          // String
  result: 'promised',                  // String，returned | promised | not_returned
  follow_up_plan: '三天后再次联系',    // String
  handler_id: 'user_xxx',
  handler_name: '李老师',
  handler_role: 'class_teacher',
  create_time: 1719000000000,
  update_time: 1719000000000,
  is_deleted: false
}
```

---

### 2.10 safety_plans（安全教育周计划）

```js
{
  _id: 'safety_plan_20240901_w01',    // String，{学期}_{周次}
  semester: '2024-2025-1',            // String
  week_no: 1,                          // Number，第几周
  theme: '交通安全',                    // String，教育主题
  content: '讲解交通规则、骑行安全...', // String，教育大致内容
  courseware_file_id: 'cloud://xxx.enbx', // String，课件云存储 fileID
  courseware_format: 'enbx',           // String，pptx | ppt | enbx（希沃）
  courseware_file_name: '交通安全课件.enbx', // String，原始文件名
  target_grades: ['grade_7', 'grade_8', 'grade_9'], // Array，适用年级
  status: 'published',                 // String，draft | published
  publisher_id: 'user_xxx',
  publisher_name: '王主任',
  create_time: 1719000000000,
  update_time: 1719000000000
}
```

---

### 2.11 safety_feedbacks（安全教育完成反馈）

```js
{
  _id: 'safety_fb_20240901_w01_class2301',
  semester: '2024-2025-1',              // String，冗余学期（便于直接按学期查询，不用 lookup plan）
  plan_id: 'safety_plan_20240901_w01', // String
  class_id: 'class_2301',
  class_name: '2301班',
  teacher_id: 'user_xxx',              // String
  teacher_name: '李老师',
  week_no: 1,                          // Number
  complete_date: '2024-09-05',         // String
  photos: [                            // Array，1-3 张照片
    'cloud://xxx1.jpg',
    'cloud://xxx2.jpg'
  ],
  remark: '',                          // String
  status: 'completed',                 // String，completed | overdue
  create_time: 1719000000000,
  update_time: 1719000000000,
  is_deleted: false
}
```

---

### 2.12 safety_activities（自主安全教育活动）

```js
{
  _id: 'safety_activity_20240622001',
  semester: '2024-2025-1',              // String，所属学期
  theme: '消防演练',                    // String
  summary: '全校师生参与消防疏散演练...', // String，简要概括
  photos: [                            // Array，1-3 张
    'cloud://xxx.jpg'
  ],
  activity_date: '2024-06-22',         // String
  submitter_id: 'user_xxx',
  submitter_name: '王主任',
  submitter_role: 'safety_head',       // String，safety_head | director
  create_time: 1719000000000,
  update_time: 1719000000000,
  is_deleted: false
}
```

---

### 2.13 moral_activities（德育活动记录）

```js
{
  _id: 'moral_activity_20240622001',
  semester: '2024-2025-1',              // String，所属学期
  theme: '诚信教育',                    // String
  summary: '开展诚信主题班会...',       // String
  photos: [                            // Array，1-3 张
    'cloud://xxx.jpg'
  ],
  activity_date: '2024-06-22',         // String
  submitter_id: 'user_xxx',
  submitter_name: '赵主任',
  submitter_role: 'director',          // String，director | class_teacher
  class_id: 'class_2301',              // String，班主任提交时关联班级
  class_name: '2301班',                // String
  create_time: 1719000000000,
  update_time: 1719000000000,
  is_deleted: false
}
```

---

### 2.14 contraband_records（违禁品记录）

```js
{
  _id: 'contraband_20240622001',

  // ---- 学期 ----
  semester: '2024-2025-1',             // String，所属学期

  // ---- 关联学生 ----
  student_id: 'student_20230601001',
  student_name: '张三',
  class_id: 'class_2301',
  class_name: '2301班',

  // ---- 查获信息 ----
  item_type: '手机',                    // String
  item_photo: 'cloud://xxx.jpg',       // String，物品照片
  description: '上课期间发现使用手机',   // String
  confiscate_date: '2024-06-22',       // String
  confiscate_location: '教室',          // String
  submitter_id: 'user_xxx',
  submitter_name: '李老师',

  // ---- 审核 ----
  approve_result: 'approved',           // String，pending | approved | rejected
  reject_reason: '',                    // String
  approver_id: 'user_yyy',
  approver_name: '赵主任',
  approve_time: 1719010000000,

  // ---- 入柜 ----
  storage_photo: 'cloud://xxx.jpg',     // String，入柜照片
  storage_location: '保险柜 A-3',       // String
  storage_time: 1719020000000,

  // ---- 领取 ----
  return_to_type: 'parent',             // String，student | parent
  return_to_name: '张父',
  return_to_id_card: 'encrypted_xxx',   // String，家长证件号（家长领时）
  return_photo: 'cloud://xxx.jpg',      // String，手持违禁品照片
  return_time: 1719030000000,
  return_handler_id: 'user_zzz',
  return_handler_name: '李老师',

  // ---- 状态（状态机） ----
  status: 'returned',                   // String，pending | approved | rejected | stored | returned

  // ---- 保管期限 ----
  keep_until: '2025-01-15',             // String，期末统一退还

  // ---- 通用 ----
  create_time: 1719000000000,
  update_time: 1719000000000,
  is_deleted: false
}
```

---

### 2.15 patrol_checkins（巡逻打卡记录）

```js
{
  _id: 'patrol_20240622001',
  semester: '2024-2025-1',              // String，所属学期
  instructor_id: 'user_xxx',            // String，教官 ID
  instructor_name: '王教官',            // String
  checkin_time: 1719000000000,          // Number，系统自动记录
  building: '教学楼',                    // String，从 patrol_locations 选择
  floor: '2F',                          // String
  description: '巡逻正常，未发现异常',    // String
  photo: 'cloud://xxx.jpg',             // String，可选佐证照片
  create_time: 1719000000000,
  update_time: 1719000000000,
  is_deleted: false
}
```

---

### 2.16 patrol_locations（打卡位置配置）

```js
{
  _id: 'patrol_loc_001',
  building: '教学楼',                    // String
  floor: '1F',                          // String
  sort_order: 1,                        // Number
  is_enabled: true,                     // Boolean
  create_time: 1719000000000,
  update_time: 1719000000000
}
```

---

### 2.17 safety_events（安全事件记录）

```js
{
  _id: 'safety_event_20240622001',
  semester: '2024-2025-1',              // String，所属学期
  title: '宿舍楼消防隐患',               // String
  type: '消防安全',                      // String，防欺凌|防溺水|防性侵|防电诈|交通安全|消防安全
  date: '2024-06-22',                   // String
  location: '宿舍楼 3F',                 // String
  involved_students: [                   // Array，涉及学生 ID
    'student_20230601001'
  ],
  detail: '发现灭火器过期...',           // String
  detail_photos: [],                     // Array
  process_notes: '已上报更换',           // String
  result: '已更换新灭火器',              // String
  status: 'closed',                      // String，processing | closed
  handler_id: 'user_xxx',
  handler_name: '王主任',
  create_time: 1719000000000,
  update_time: 1719000000000,
  is_deleted: false
}
```

---

## 3. 日志与配置集合

### 3.1 operation_logs（操作日志）

```js
{
  _id: 'log_20240622001',
  semester: '2024-2025-1',              // String，所属学期（用于归档）
  operator_id: 'user_xxx',              // String
  operator_name: '赵主任',
  operator_role: 'director',            // String
  action: 'approve',                    // String，create|update|delete|approve|close|export
  target: 'discipline_records',         // String，操作对象集合名
  target_id: 'discipline_20240622001',  // String
  detail: '审核通过了张三的警告处分',     // String，简要描述
  ip: '',                               // String（可选）
  create_time: 1719000000000
}
// 注意：操作日志不设 is_deleted，按时间归档
```

---

### 3.2 config_tags（标签映射配置）

```js
{
  _id: 'config_tag_001',
  name: '单亲家庭',                      // String，标签名
  group: '家庭相关',                     // String，前端展示分组
  category_6: '家庭类',                  // String，六类归类（可空）
  category_4: '特殊家庭',                // String，四特归类（可空）
  category_out: '',                      // String，在籍不在校归类（可空）
  sort_order: 1,                         // Number
  is_enabled: true,                      // Boolean
  create_time: 1719000000000,
  update_time: 1719000000000
}
```

---

### 3.3 config_contraband_types（违禁品类型配置）

```js
{
  _id: 'config_ct_001',
  name: '手机',                          // String
  sort_order: 1,                         // Number
  is_enabled: true,                      // Boolean
  create_time: 1719000000000,
  update_time: 1719000000000
}
```

---

### 3.4 config_semester（学期配置）

```js
{
  _id: 'semester_2024-2025-1',          // String
  name: '2024-2025学年第一学期',         // String
  first_week_date: '2024-09-02',         // String，第一周起始日（周一）
  total_weeks: 20,                       // Number，学期总周数
  is_current: true,                      // Boolean，是否当前学期
  grade_upgrade_month: 8,                // Number，年级升级月份
  grade_upgrade_day: 1,                  // Number，年级升级日期
  create_time: 1719000000000,
  update_time: 1719000000000
}
```

---

## 4. 索引设计

```js
// ========== users ==========
db.collection('users').createIndex({ openid: 1 }, { unique: true })
db.collection('users').createIndex({ role: 1, status: 1 })

// ========== students ==========
db.collection('students').createIndex({ class_id: 1, is_deleted: 1 })
db.collection('students').createIndex({ grade_id: 1, is_deleted: 1 })
db.collection('students').createIndex({ 'tags.category_6': 1 })
db.collection('students').createIndex({ 'tags.category_4': 1 })
db.collection('students').createIndex({ out_of_school_status: 1 })
db.collection('students').createIndex({ name: 'text' })   // 搜索用

// ========== student_tags ==========
db.collection('student_tags').createIndex({ student_id: 1, create_time: -1 })
db.collection('student_tags').createIndex({ submitter_id: 1, create_time: -1 })

// ========== discipline_records ==========
db.collection('discipline_records').createIndex({ semester: 1, student_id: 1, is_deleted: 1 })
db.collection('discipline_records').createIndex({ semester: 1, class_id: 1, is_deleted: 1 })
db.collection('discipline_records').createIndex({ semester: 1, status: 1, create_time: -1 })

// ========== talk_records ==========
db.collection('talk_records').createIndex({ semester: 1, student_id: 1, create_time: -1 })
db.collection('talk_records').createIndex({ semester: 1, next_follow_up_date: 1, is_deleted: 1 })

// ========== visit_records ==========
db.collection('visit_records').createIndex({ semester: 1, student_id: 1 })

// ========== persuasion_records ==========
db.collection('persuasion_records').createIndex({ semester: 1, student_id: 1, create_time: -1 })

// ========== safety_plans ==========
db.collection('safety_plans').createIndex({ semester: 1, week_no: 1 }, { unique: true })

// ========== safety_feedbacks ==========
db.collection('safety_feedbacks').createIndex({ semester: 1, plan_id: 1, class_id: 1 })
db.collection('safety_feedbacks').createIndex({ semester: 1, class_id: 1, status: 1 })

// ========== safety_activities ==========
db.collection('safety_activities').createIndex({ semester: 1, submitter_id: 1, create_time: -1 })

// ========== moral_activities ==========
db.collection('moral_activities').createIndex({ semester: 1, submitter_id: 1, create_time: -1 })
db.collection('moral_activities').createIndex({ semester: 1, class_id: 1, create_time: -1 })

// ========== contraband_records ==========
db.collection('contraband_records').createIndex({ semester: 1, student_id: 1, is_deleted: 1 })
db.collection('contraband_records').createIndex({ semester: 1, status: 1, create_time: -1 })

// ========== patrol_checkins ==========
db.collection('patrol_checkins').createIndex({ semester: 1, instructor_id: 1, checkin_time: -1 })
db.collection('patrol_checkins').createIndex({ semester: 1, checkin_time: -1 })

// ========== patrol_locations ==========
db.collection('patrol_locations').createIndex({ building: 1, floor: 1 }, { unique: true })

// ========== safety_events ==========
db.collection('safety_events').createIndex({ semester: 1, type: 1, create_time: -1 })
db.collection('safety_events').createIndex({ semester: 1, status: 1 })

// ========== operation_logs ==========
db.collection('operation_logs').createIndex({ semester: 1, operator_id: 1, create_time: -1 })
db.collection('operation_logs').createIndex({ semester: 1, target: 1, target_id: 1 })
db.collection('operation_logs').createIndex({ semester: 1, create_time: -1 })

// ========== config_tags ==========
db.collection('config_tags').createIndex({ name: 1 }, { unique: true })
db.collection('config_tags').createIndex({ group: 1, sort_order: 1 })

// ========== config_contraband_types ==========
db.collection('config_contraband_types').createIndex({ name: 1 }, { unique: true })

// ========== config_semester ==========
db.collection('config_semester').createIndex({ is_current: 1 })
```

---

## 5. 数据归档策略

### 5.1 核心原则

```
在线集合只保留「当前学期 + 上一学期」数据
    ↓
每年暑假（8月）执行云函数定时任务
    ↓
将上上学期的数据移至 {collection}_archive 归档集合
    ↓
需要时管理员可查看归档数据，不需要时直接删归档集合
```

### 5.2 归档集合命名

| 在线集合 | 归档集合 |
|------|------|
| `discipline_records` | `discipline_records_archive` |
| `patrol_checkins` | `patrol_checkins_archive` |
| `safety_feedbacks` | `safety_feedbacks_archive` |
| `safety_plans` | `safety_plans_archive` |
| `talk_records` | `talk_records_archive` |
| `visit_records` | `visit_records_archive` |
| `persuasion_records` | `persuasion_records_archive` |
| `contraband_records` | `contraband_records_archive` |
| `safety_activities` | `safety_activities_archive` |
| `moral_activities` | `moral_activities_archive` |
| `safety_events` | `safety_events_archive` |
| `operation_logs` | `operation_logs_archive` |
| `student_tags` | `student_tags_archive` |

### 5.3 归档云函数伪代码

```js
// cloudfunctions/cron-archive/index.js
const ARCHIVE_COLLECTIONS = [
  'discipline_records', 'patrol_checkins', 'safety_feedbacks',
  'safety_plans', 'talk_records', 'visit_records', 'persuasion_records',
  'contraband_records', 'safety_activities', 'moral_activities',
  'safety_events', 'operation_logs', 'student_tags'
]

exports.main = async () => {
  const semesters = await db.collection('config_semester')
    .where({ is_current: false }).orderBy('first_week_date', 'desc').get()

  // 找到需要归档的学期：非当前、非上一学期
  const toArchive = semesters.data.slice(2)

  for (const semester of toArchive) {
    for (const coll of ARCHIVE_COLLECTIONS) {
      const docs = await db.collection(coll)
        .where({ semester: semester._id }).get()

      if (docs.data.length > 0) {
        // 写入归档集合
        for (const doc of docs.data) {
          await db.collection(`${coll}_archive`).add({ data: doc })
        }
        // 从在线集合删除
        // 注意：云函数批量删除需分批处理
      }
    }
    console.log(`[归档完成] ${semester.name}`)
  }
}
```

### 5.4 查询规则

| 查询场景 | 查询目标 | 条件 |
|------|------|------|
| 日常业务（默认） | 在线集合 | `where({ semester: currentSemester })` |
| 查看上学期数据 | 在线集合 | `where({ semester: lastSemester })` |
| 查看历史数据 | 归档集合 | `where({ semester: targetSemester })` |
| 跨学期统计 | 在线 + 归档 | 分别查询后合并，或用 `_.in` |

> ⚠️ **所有写操作只发生在在线集合**，归档集合只读。

---

## 6. 集合关系图

```
users ───────────────────────────────────────────────────────────────┐
  │                                                                    │
  │ role: class_teacher ──── students ──── student_tags               │
  │                              │          discipline_records        │
  │                              │          talk_records              │
  │                              │          visit_records             │
  │                              │          persuasion_records        │
  │                              │          contraband_records        │
  │                              │                                     │
  │ role: instructor ────────────┤─── discipline_records (处理)       │
  │                              │─── patrol_checkins                 │
  │                              │─── contraband_records (发起)       │
  │                              │                                     │
  │ role: psychology_teacher ────┤─── talk_records                    │
  │                              │                                     │
  │ role: safety_head ───────────┤─── safety_plans                    │
  │                              │─── safety_activities               │
  │                              │─── safety_events                   │
  │                              │─── patrol_checkins (查看)          │
  │                              │                                     │
  │ role: director ──────────────┤─── discipline_records (审核)       │
  │                              │─── contraband_records (审核+领取)  │
  │                              │─── moral_activities                │
  │                              │─── patrol_checkins (查看)          │
  │                              │                                     │
  │ role: safety_member ─────────┤─── safety_events                   │
  │                              │                                     │
  └──────────────────────────────┘                                     │
                                                                       │
classes ──────── students                                              │
grades ──────── classes ──── students                                  │
                                                                       │
config_tags ──── (student.tags 映射依据)                               │
config_contraband_types ──── contraband_records (类型选择)             │
config_semester ──── safety_plans (周次计算) + grades (升级)           │
patrol_locations ──── patrol_checkins (位置选择)                       │
                                                                       │
operation_logs ──── (所有业务集合的操作记录)                            │
```

---

> **使用说明**：
> - 每个集合的 `create_time` / `update_time` 为毫秒时间戳
> - `is_deleted: true` 表示软删除，查询时总是追加 `{ is_deleted: false }` 或 `_.neq(true)`
> - 自定义 ID 格式：`{前缀}_{日期}{序号}`，如 `student_20240622001`
> - 加密字段（`id_card`）在云函数中使用 crypto 模块 AES 加密，密钥存云函数环境变量
