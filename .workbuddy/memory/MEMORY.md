# 调休管理系统 - 项目长期记录

## 技术栈
- Next.js 15.3.3 + React 19 + TypeScript
- Supabase（PostgreSQL）作为数据库
- pnpm 作为包管理器
- bcryptjs 做密码哈希

## 环境配置
- .env.local 已配置 Supabase 凭据（pnqfvfhqekgroliztnuo 项目）
- JWT_SECRET 有代码内默认值，不强制配置

## 启动方式
必须用 Node 22 直接调用 next 的 JS 入口，不能用 Node 24（shim 脚本格式不兼容）：
```
C:\Users\administered\.workbuddy\binaries\node\versions\22.22.2\node.exe node_modules/next/dist/bin/next dev --port 3000
```

## pnpm 安装注意
- 若 pnpm install 报 "unable to open database file"，需加 --loglevel debug 触发调试模式安装
- store 路径问题可通过 --store-dir 指定本地目录解决

## 数据库初始化
- 初始化 SQL 在 scripts/init-db.sql
- 管理员账号：admin / admin123
- 需在 Supabase SQL Editor 手动执行（Management API 无法用 service_role key 访问）

## 数据库表
- health_check
- employees（含 role_category: admin/functional_tech/management/production）
- overtime_records（加班记录，三级审批）
- leave_requests（调休申请，三级审批）
- overtime_balances（余额汇总）
- approval_rules（审批规则配置）

## Supabase PostgREST FK 关联查询关键经验

**FK 约束名称问题**：PostgreSQL 自动生成的 FK 约束名格式为 `{table}_{column}_fkey`，而非代码中可能使用
的自定义名称 `{table}_{column}_employees_id_fk`。

**Supabase `.select()` FK hint 语法**：
```
employees!{constraint_name}(columns)
```
其中 `constraint_name` 必须与 PostgreSQL 中实际 FK 约束名完全匹配。可通过 Supabase SQL Editor 执行
以下查询获取实际 FK 名称：
```sql
SELECT conname FROM pg_constraint WHERE conrelid = 'overtime_records'::regclass AND contype = 'f';
```

**受影响文件**（共 9 个，全部已修复）：
- overtime/route.ts, leave/route.ts, approval/route.ts, balances/route.ts
- overtime/export/route.ts, overtime/export-docx/route.ts
- leave/export/route.ts, leave/export-docx/route.ts
- employees/route.ts
