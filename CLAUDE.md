# 关中智慧校园 - CLAUDE.md

> 本文档是 AI 助手的编码约定索引。详细内容见 `需求文档.md` / `智慧校园小程序开发规范.md` / `智慧校园数据库Schema设计.md`。

## 技术栈

微信小程序原生 + 微信云开发（云函数 + 云数据库 + 云存储），UI 用 WeUI 原生样式。

## 目录结构（不可偏离）

```
miniprogram/
├── pages/模块名/          # 页面（每页一个子目录，kebab-case）
├── components/组件名/     # 公共组件（kebab-case）
├── utils/                 # 工具函数（auth.js, request.js, validator.js, constants.js...）
└── styles/weui.wxss       # 全局样式

cloudfunctions/
├── 模块名/                # 云函数目录，一个模块一个云函数
│   ├── index.js           # 入口
│   └── package.json
└── common/utils/          # 公共工具（success/fail/pageResult）
```

页面和云函数严格一一对应：`pages/student/` ↔ `cloudfunctions/student/`。不要创建独立于模块之外的云函数。

## 命名速查

| 范围 | 规范 | 示例 |
|------|------|------|
| 文件/目录 | `kebab-case` | `student-list`, `photo-uploader` |
| JS 变量/函数 | `camelCase` | `studentName`, `getStudentList()` |
| 布尔变量 | `is/has/can` 前缀 | `isLoading`, `hasMore` |
| 云函数调用名 | `动词+名词` camelCase | `submitTag`, `approveContraband` |
| **数据库集合** | **`snake_case`** 复数 | `students`, `discipline_records` |
| **数据库字段** | **`snake_case`** | `student_name`, `create_time` |
| **`_id`** | **字符串**（不用 ObjectId） | `'student_20230601001'` |

⚠️ **JS 侧 camelCase，数据库侧 snake_case**——这是本项目最容易出错的点。

## 云函数模式（核心）

每个云函数都遵循同一模式，偏离即错误：

```js
// cloudfunctions/模块名/index.js
const { success, fail, pageResult } = require('common/utils')

exports.main = async (event, context) => {
  const { action, data = {} } = event
  const { OPENID } = cloud.getWXContext()

  try {
    // 1. 鉴权（必须，不可省略）
    const user = await getUserByOpenId(OPENID)
    if (!user) return fail(401, '用户未注册')

    // 2. 路由
    switch (action) {
      case 'list':   return handleList(data, user)
      case 'create': return handleCreate(data, user)
      case 'update': return handleUpdate(data, user)
      default:       return fail(400, `未知操作: ${action}`)
    }
  } catch (err) {
    console.error(`[模块名]`, err)
    return fail(500, '服务器内部错误')
  }
}
```

**前端调用方式**（不要直接 `wx.cloud.callFunction`）：

```js
const { callCloudFunction } = require('../../../utils/request')
const res = await callCloudFunction('student', { action: 'list', data: { page: 1 } })
```

## 统一返回格式（不可变）

```js
// 成功
{ code: 0, message: 'ok', data: {...} }
// 分页
{ code: 0, message: 'ok', data: { list: [...], total: 156, page: 1, pageSize: 20 } }
// 失败
{ code: 400, message: '参数错误', data: null }    // 400/401/403/404/422/500
```

## 权限校验（最高优先级）

```
前端只隐藏按钮 → 后端（云函数）做真正鉴权 → 永远不信任前端传来的 role
```

每个云函数从 `OPENID` 查用户，禁止从前端参数取 role。班主任只能看自己班数据（buildPermissionFilter）。

## 状态机模式

所有带状态的实体（违纪、违禁品、安全反馈等）必须用状态转移表驱动，禁止零散 if-else：

```js
const TRANSITIONS = {
  'pending':  { allowed: ['approve','reject'], next: { approve: 'approved', reject: 'rejected' }},
  'approved': { allowed: ['store'],            next: { store: 'stored' }},
  'stored':   { allowed: ['return'],           next: { return: 'returned' }},
  'returned': { allowed: [] }  // 终态
}
```

## 数据库核心约定

- 每个文档必有：`_id(String)`, `create_time(Number)`, `update_time(Number)`, `is_deleted(Boolean)`
- **所有时间关联集合必有 `semester` 字段**（格式 `2024-2025-1`），查询时首条件必须带 semester
- **宁冗余 class_name/grade_name，不 lookup 联表查询**
- 标签用数组存于学生文档：`tags: ['单亲家庭', '疑似辍学']`
- 身份证：加密存 `id_card` + 明文冗余 `id_card_last4`（后4位）
- 旧学期数据定时归档到 `{collection}_archive`，在线集合只保留当前+上一学期

## 禁止事项

| # | ❌ 禁止 | ✅ 正确 |
|---|--------|--------|
| 1 | 前端做鉴权判断 | 云函数中校验角色+数据范围 |
| 2 | 零散 if-else 判断状态 | 状态机驱动 |
| 3 | 循环中调用云函数 | 批量接口或 Promise.all |
| 4 | lookup 联表查询 | 冗余字段 |
| 5 | 前端生成 Excel/PDF | 云函数生成 |
| 6 | 明文存储身份证 | AES 加密 + id_card_last4 |
| 7 | 全量加载列表 | skip + limit 分页 |
| 8 | 硬编码密钥/云函数名 | 环境变量 / constants.js |
| 9 | 不带 semester 条件查历史数据集合 | where 首字段必须为 semester，命中复合索引 |

详细内容参考 `智慧校园小程序开发规范.md` 第 11 节。

## 关键源文档

遇到以下场景时，主动 Read 对应文档：

- 不理解某个业务模块逻辑 → 读 `需求文档.md`
- 需要某集合的完整字段定义 → 读 `智慧校园数据库Schema设计.md`
- 不确定代码风格/命名/模板 → 读 `智慧校园小程序开发规范.md`
