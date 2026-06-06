# 部门调休管理平台 - AGENTS.md

## 项目概览

部门调休管理平台，支持四类角色（超级管理员、职能技术岗、管理岗、生产岗）的加班登记、调休申请与三级审批流程。用户使用工号登录系统。

## 版本技术栈

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4
- **Database**: Supabase (PostgreSQL)
- **Auth**: JWT (jose) + bcryptjs 自建认证

## 目录结构

```
├── src/
│   ├── app/
│   │   ├── (auth)/              # 认证页面 (登录/注册)
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── (main)/              # 主业务页面
│   │   │   ├── dashboard/       # 工作台
│   │   │   ├── overtime/        # 加班管理
│   │   │   ├── leave/           # 调休管理
│   │   │   ├── approval/        # 审批中心
│   │   │   ├── employees/       # 人员管理
│   │   │   ├── balances/        # 工时汇总
│   │   │   ├── import/          # 数据导入
│   │   │   └── profile/         # 个人中心
│   │   └── api/                 # API 路由
│   │       ├── auth/            # 认证 (login/register/logout/me/change-password/profile/signature)
│   │       ├── employees/       # 人员 CRUD + 批量导入 + 重置密码
│   │       ├── overtime/        # 加班 CRUD + 导入/导出/导出DOCX + 审批
│   │       ├── leave/           # 调休 CRUD + 导出/导出DOCX + 审批
│   │       ├── approval/        # 审批列表
│   │       ├── dashboard/       # 仪表盘数据
│   │       └── balances/        # 工时汇总
│   ├── components/
│   │   ├── ui/                  # shadcn/ui 组件
│   │   └── main-layout.tsx      # 主布局 (侧边栏 + 内容区)
│   ├── hooks/
│   │   └── use-auth.tsx         # 认证 Context Hook
│   ├── lib/
│   │   ├── auth-shared.ts       # 认证工具 (客户端安全 - 类型/常量/角色判断)
│   │   ├── auth.ts              # 认证服务端 (getCurrentUser, re-export auth-shared)
│   │   └── password.ts          # 密码加密工具
│   └── storage/database/
│       ├── supabase-client.ts   # Supabase 客户端
│       └── shared/schema.ts     # 数据库 Schema 定义
└── public/
```

## 构建和运行命令

```bash
pnpm install          # 安装依赖
pnpm run dev          # 开发环境 (端口 5000)
pnpm run build        # 构建
pnpm run start        # 生产环境
```

## 认证架构

- **双模式认证**: JWT Token 同时存入 localStorage (Authorization 头) 和 httpOnly cookie (`auth_token`)
- **客户端**: `use-auth.tsx` 提供 AuthProvider + useAuth Hook + fetchWithAuth + updateProfile
- **服务端**: `auth.ts` 的 `getCurrentUser()` 优先检查 Authorization 头，再检查 cookie
- **重要**: 客户端组件必须从 `auth-shared.ts` 导入常量/类型，不能从 `auth.ts` 导入（因 next/headers 仅限服务端）

## 数据导入模板下载

- **人员导入模板**: `GET /api/employees/import/template` - 返回含示例数据的CSV模板
- **加班导入模板**: `GET /api/overtime/import/template` - 返回含示例数据的CSV模板
- **导入页面**: 提供"下载模板"按钮，支持fetch+blob方式下载

## 加班/调休记录管理

- **管理员编辑加班**: `PUT /api/overtime/[id]` action=edit (修改日期/工时/说明)
- **管理员删除加班**: `DELETE /api/overtime/[id]` (删除记录并回退余额)
- **管理员编辑调休**: `PUT /api/leave/[id]` action=edit (修改时间/工时/原因)
- **管理员删除调休**: `DELETE /api/leave/[id]` (删除记录并恢复余额)
- **员工撤回**: `PUT /api/overtime/[id]` 或 `/api/leave/[id]` action=withdraw (仅限自己未审批的记录)
- **员工编辑**: `PUT /api/overtime/[id]` 或 `/api/leave/[id]` action=edit (仅限自己pending状态的记录，需重新选择审批人)
- **撤回条件**: 只能撤回 status=pending 的记录（审批人尚未审批）
- **余额联动**: 删除已审批的加班记录会扣减余额，删除已审批的调休记录会恢复余额

## 成员管理权限

- **个人中心** (`/profile`): 所有用户可修改自己的姓名、电话、部门、模块、工班，以及修改密码（需验证旧密码），上传/绘制手写签名
- **手写签名**: 每个用户必须设置永久性手写签名，用于导出申请单时嵌入签名图片
- **签名上传 API**: `POST /api/auth/signature` (FormData: file=图片文件)
- **签名获取 API**: `GET /api/auth/signature` (返回 signature_url 和 has_signature)
- **管理员**: 可修改所有人员的全部信息（含角色、岗位、状态、模块、工班），可重置他人密码为 123456
- **普通用户编辑自己**: 仅限 name/phone/department/module/squad，不能修改角色/岗位
- **修改密码 API**: `POST /api/auth/change-password` (需 old_password + new_password)
- **个人信息 API**: `PUT /api/auth/profile` (name/phone/department/module/squad)
- **管理员重置密码**: `POST /api/employees/[id]/reset-password` (管理岗+超级管理员)
- **超级管理员账号**: 工号=`admin`, password=`admin123`
- **注册限制**: 超级管理员(admin)角色不能通过注册页面创建，只能由超级管理员在人员管理页面创建
- **工号登录**: 用户使用工号(username字段)登录系统，非姓名

## 角色与审批体系

### 四类角色
| 角色分类 | 岗位 | 审批流向 | 特殊权限 |
|---------|------|---------|---------|
| admin | 系统管理员 | 可审批所有 | 最高权限：查看/管理所有数据，审批所有记录，创建管理员账号 |
| functional_tech | 仓储工作岗、安全工作岗、综合事务岗、物资工作岗、招标采购岗、合同工作岗、其他职能技术岗 | 手动选择审批人（见下方规则） | 按模块查看考勤数据 |
| management | 经理、副经理、经理助理 | N/A (管理岗无需被审批) | 管理人员信息，经理可查看部门所有人员考勤数据，副经理/经理助理按模块查看考勤数据 |
| production | 仓管员 | 手动选择审批人（见下方规则） | - |
| production | 仓储工班长 | 手动选择审批人（见下方规则） | 按班组查看考勤数据 |

### 超级管理员 (admin) 权限
- 查看所有用户的加班、调休、余额数据
- 可为任意用户代登记加班、代申请调休
- 可执行一/二/三级审批（可跳级审批）
- 管理所有人员信息（含角色、岗位、状态），按模块筛选
- 重置任意用户密码为123456
- 创建/编辑其他管理员账号（仅admin可创建admin）
- 查看所有审批事项
- 导出台账可选日期范围
- 批量导出调休/加班申请单DOCX（带手写签名）

## 申请单导出 (DOCX)

- **调休申请单导出**: `POST /api/leave/export-docx` (body: record_ids[], is_admin_batch?)
  - 单条导出：用户可导出自己的记录
  - 批量导出：管理员可批量勾选导出
  - 生成 DOCX 按《员工调休申请单—2022版》模板格式，包含申请人签名和审批人签名
- **加班登记单导出**: `POST /api/overtime/export-docx` (body: record_ids[], is_admin_batch?)
  - 同上逻辑
- **签名存储**: employees.signature_key 字段存储对象存储 key
- **DOCX 内容**: 姓名、部门、岗位、起止时间、工时、原因/说明、审批人签名区域
- **批量导出**: 生成 ZIP 包含多个 DOCX 文件

### 审批规则（手动选择审批人）
提交加班/调休时，申请人需手动选择审批人。系统根据岗位+调休天数自动确定需要的审批级别和可选审批人范围：

**加班审批**：
| 申请人岗位 | 审批级别 | 一级审批人 | 二级审批人 |
|-----------|---------|-----------|-----------|
| 仓管员 | 一级 | 仓储工班长 | - |
| 仓储工班长 | 二级 | 副经理/经理助理 | 经理 |
| 职能技术岗 | 一级 | 经理/副经理/经理助理 | - |
| 副经理/经理助理 | 一级 | 经理 | - |

**调休审批**：
| 申请人岗位 | 调休时长 | 审批级别 | 一级审批人 | 二级审批人 | 三级审批人 |
|-----------|---------|---------|-----------|-----------|-----------|
| 职能技术岗/仓储工班长 | ≤1天(8h) | 一级 | 经理/副经理/经理助理 | - | - |
| 职能技术岗/仓储工班长 | >1天 | 二级 | 副经理/经理助理 | 经理 | - |
| 副经理/经理助理 | 任意 | 一级 | 经理 | - | - |
| 仓管员 | ≤1天(8h) | 一级 | 仓储工班长 | - | - |
| 仓管员 | 1-3天(8-24h) | 二级 | 仓储工班长 | 副经理/经理助理 | - |
| 仓管员 | >3天(24h) | 三级 | 仓储工班长 | 副经理/经理助理 | 经理 |

### 审批状态流
- 加班: `pending` → `level1_approved` → `level2_approved`/`approved` (或 `rejected`/`withdrawn`)
- 调休: `pending` → `level1_approved` → `level2_approved` → `approved` (或 `rejected`/`withdrawn`)
- 三级审批: `pending` → `level1_approved` → `level2_approved` → `approved`
- 撤回: 仅在 `pending` 状态下可撤回，撤回后状态变为 `withdrawn`

### 获取可选审批人
- `GET /api/approvers?position=岗位&hours=工时数&is_leave=true/false`
- 返回审批级别规则和各级可选审批人列表

## 数据库表

| 表名 | 说明 |
|------|------|
| employees | 员工信息 (含密码hash、岗位、角色、模块、工班、signature_key签名存储key) |
| overtime_records | 加班记录 (含start/end_time、三级审批字段、selected_approver字段) |
| leave_requests | 调休申请 (含三级审批字段、selected_approver字段) |
| overtime_balances | 工时余额汇总 (加班-调休) |
| approval_rules | 审批规则配置 |

## 代码风格指南

- 严格 TypeScript: 禁止隐式 any，函数参数必须标注类型
- 客户端组件标记 'use client'
- shadcn/ui 组件优先
- Supabase 外键名格式: `{table}_{column}_employees_id_fk`
- API 路由使用 `getSupabaseClient()` 的 service_role 模式

## 关键约定

- 初始密码: 123456
- JWT 过期: 7天
- cookie 名称: auth_token (httpOnly)
- 认证方式: Authorization: Bearer <token> (优先) + cookie (兜底)
- 分页默认: page=1, page_size=20
- 工号登录: 用户使用工号(username)登录
- 模块选项: 仓储物流模块、物资计划模块、物资采购模块、综合模块
- 工班选项: 东部储运工班、南部储运工班、西部储运工班（生产岗必选）
- 注册限制: admin角色不允许通过注册页面创建
- 权限数据查看: 加班/调休管理只看自己的记录；工时汇总中超级管理员看全部，经理看部门所有人员，副经理/经理助理按模块，仓储工班长按班组，普通用户只看自己
