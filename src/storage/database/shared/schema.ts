import { sql } from "drizzle-orm";
import { pgTable, serial, varchar, timestamp, boolean, text, numeric, date, index } from "drizzle-orm/pg-core";

// System table - DO NOT DELETE
export const healthCheck = pgTable("health_check", {
  id: serial().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// 员工表 - 所有系统用户
export const employees = pgTable("employees", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  username: varchar("username", { length: 50 }).notNull().unique(),
  password_hash: varchar("password_hash", { length: 255 }).notNull(),
  name: varchar("name", { length: 50 }).notNull(),
  role_category: varchar("role_category", { length: 20 }).notNull(), // admin | functional_tech | management | production
  position: varchar("position", { length: 50 }).notNull(),
  department: varchar("department", { length: 100 }),
  module: varchar("module", { length: 100 }),
  squad: varchar("squad", { length: 100 }),
  phone: varchar("phone", { length: 20 }),
  signature_key: text("signature_key"), // 手写签名的对象存储key
  is_active: boolean("is_active").default(true).notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }),
}, (table) => [
  index("employees_username_idx").on(table.username),
  index("employees_role_category_idx").on(table.role_category),
  index("employees_position_idx").on(table.position),
]);

// 加班工时记录
export const overtimeRecords = pgTable("overtime_records", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  employee_id: varchar("employee_id", { length: 36 }).notNull().references(() => employees.id),
  overtime_date: date("overtime_date").notNull(),
  start_time: timestamp("start_time", { withTimezone: true }),
  end_time: timestamp("end_time", { withTimezone: true }),
  hours: numeric("hours", { precision: 8, scale: 2 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending | level1_approved | level2_approved | approved | rejected
  // 选定审批人
  selected_level1_approver_id: varchar("selected_level1_approver_id", { length: 36 }).references(() => employees.id),
  selected_level2_approver_id: varchar("selected_level2_approver_id", { length: 36 }).references(() => employees.id),
  selected_level3_approver_id: varchar("selected_level3_approver_id", { length: 36 }).references(() => employees.id),
  // 一级审批
  level1_approver_id: varchar("level1_approver_id", { length: 36 }).references(() => employees.id),
  level1_approved_at: timestamp("level1_approved_at", { withTimezone: true }),
  level1_approver_name: varchar("level1_approver_name", { length: 50 }),
  level1_remark: text("level1_remark"),
  // 二级审批
  level2_approver_id: varchar("level2_approver_id", { length: 36 }).references(() => employees.id),
  level2_approved_at: timestamp("level2_approved_at", { withTimezone: true }),
  level2_approver_name: varchar("level2_approver_name", { length: 50 }),
  level2_remark: text("level2_remark"),
  // 三级审批
  level3_approver_id: varchar("level3_approver_id", { length: 36 }).references(() => employees.id),
  level3_approved_at: timestamp("level3_approved_at", { withTimezone: true }),
  level3_approver_name: varchar("level3_approver_name", { length: 50 }),
  level3_remark: text("level3_remark"),
  imported: boolean("imported").default(false).notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }),
}, (table) => [
  index("overtime_records_employee_id_idx").on(table.employee_id),
  index("overtime_records_status_idx").on(table.status),
  index("overtime_records_overtime_date_idx").on(table.overtime_date),
  index("overtime_records_level1_approver_id_idx").on(table.level1_approver_id),
  index("overtime_records_level2_approver_id_idx").on(table.level2_approver_id),
]);

// 调休申请
export const leaveRequests = pgTable("leave_requests", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  employee_id: varchar("employee_id", { length: 36 }).notNull().references(() => employees.id),
  start_time: timestamp("start_time", { withTimezone: true }).notNull(),
  end_time: timestamp("end_time", { withTimezone: true }).notNull(),
  hours: numeric("hours", { precision: 8, scale: 2 }).notNull(),
  reason: text("reason"),
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending | level1_approved | level2_approved | approved | rejected
  // 选定审批人
  selected_level1_approver_id: varchar("selected_level1_approver_id", { length: 36 }).references(() => employees.id),
  selected_level2_approver_id: varchar("selected_level2_approver_id", { length: 36 }).references(() => employees.id),
  selected_level3_approver_id: varchar("selected_level3_approver_id", { length: 36 }).references(() => employees.id),
  // 一级审批
  level1_approver_id: varchar("level1_approver_id", { length: 36 }).references(() => employees.id),
  level1_approved_at: timestamp("level1_approved_at", { withTimezone: true }),
  level1_approver_name: varchar("level1_approver_name", { length: 50 }),
  level1_remark: text("level1_remark"),
  // 二级审批
  level2_approver_id: varchar("level2_approver_id", { length: 36 }).references(() => employees.id),
  level2_approved_at: timestamp("level2_approved_at", { withTimezone: true }),
  level2_approver_name: varchar("level2_approver_name", { length: 50 }),
  level2_remark: text("level2_remark"),
  // 三级审批
  level3_approver_id: varchar("level3_approver_id", { length: 36 }).references(() => employees.id),
  level3_approved_at: timestamp("level3_approved_at", { withTimezone: true }),
  level3_approver_name: varchar("level3_approver_name", { length: 50 }),
  level3_remark: text("level3_remark"),
  imported: boolean("imported").default(false),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }),
}, (table) => [
  index("leave_requests_employee_id_idx").on(table.employee_id),
  index("leave_requests_status_idx").on(table.status),
  index("leave_requests_start_time_idx").on(table.start_time),
  index("leave_requests_level1_approver_id_idx").on(table.level1_approver_id),
  index("leave_requests_level2_approver_id_idx").on(table.level2_approver_id),
]);

// 加班余额汇总
export const overtimeBalances = pgTable("overtime_balances", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  employee_id: varchar("employee_id", { length: 36 }).notNull().references(() => employees.id),
  total_overtime_hours: numeric("total_overtime_hours", { precision: 8, scale: 2 }).notNull().default("0"),
  used_leave_hours: numeric("used_leave_hours", { precision: 8, scale: 2 }).notNull().default("0"),
  remaining_hours: numeric("remaining_hours", { precision: 8, scale: 2 }).notNull().default("0"),
  updated_at: timestamp("updated_at", { withTimezone: true }),
}, (table) => [
  index("overtime_balances_employee_id_idx").on(table.employee_id),
]);

// 审批规则配置
export const approvalRules = pgTable("approval_rules", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  applicant_role: varchar("applicant_role", { length: 50 }).notNull(), // 申请人的岗位
  applicant_category: varchar("applicant_category", { length: 20 }).notNull(), // 申请人的角色分类
  level1_approver_position: varchar("level1_approver_position", { length: 50 }).notNull(), // 一级审批人岗位
  level2_approver_position: varchar("level2_approver_position", { length: 50 }), // 二级审批人岗位（可选）
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }),
}, (table) => [
  index("approval_rules_applicant_role_idx").on(table.applicant_role),
  index("approval_rules_applicant_category_idx").on(table.applicant_category),
]);
