-- ============================================================
-- 调休管理系统 - Supabase 数据库初始化脚本
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================================

-- 1. 健康检查表
CREATE TABLE IF NOT EXISTS health_check (
  id SERIAL NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO health_check (id) VALUES (1) ON CONFLICT DO NOTHING;

-- 2. 员工表
CREATE TABLE IF NOT EXISTS employees (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::varchar,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(50) NOT NULL,
  role_category VARCHAR(20) NOT NULL,  -- admin | functional_tech | management | production
  position VARCHAR(50) NOT NULL,
  department VARCHAR(100),
  module VARCHAR(100),
  squad VARCHAR(100),
  phone VARCHAR(20),
  signature_key TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS employees_username_idx ON employees(username);
CREATE INDEX IF NOT EXISTS employees_role_category_idx ON employees(role_category);
CREATE INDEX IF NOT EXISTS employees_position_idx ON employees(position);

-- 3. 加班工时记录表
CREATE TABLE IF NOT EXISTS overtime_records (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::varchar,
  employee_id VARCHAR(36) NOT NULL REFERENCES employees(id),
  overtime_date DATE NOT NULL,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  hours NUMERIC(8,2) NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- 选定审批人
  selected_level1_approver_id VARCHAR(36) REFERENCES employees(id),
  selected_level2_approver_id VARCHAR(36) REFERENCES employees(id),
  selected_level3_approver_id VARCHAR(36) REFERENCES employees(id),
  -- 一级审批
  level1_approver_id VARCHAR(36) REFERENCES employees(id),
  level1_approved_at TIMESTAMPTZ,
  level1_approver_name VARCHAR(50),
  level1_remark TEXT,
  -- 二级审批
  level2_approver_id VARCHAR(36) REFERENCES employees(id),
  level2_approved_at TIMESTAMPTZ,
  level2_approver_name VARCHAR(50),
  level2_remark TEXT,
  -- 三级审批
  level3_approver_id VARCHAR(36) REFERENCES employees(id),
  level3_approved_at TIMESTAMPTZ,
  level3_approver_name VARCHAR(50),
  level3_remark TEXT,
  imported BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS overtime_records_employee_id_idx ON overtime_records(employee_id);
CREATE INDEX IF NOT EXISTS overtime_records_status_idx ON overtime_records(status);
CREATE INDEX IF NOT EXISTS overtime_records_overtime_date_idx ON overtime_records(overtime_date);
CREATE INDEX IF NOT EXISTS overtime_records_level1_approver_id_idx ON overtime_records(level1_approver_id);
CREATE INDEX IF NOT EXISTS overtime_records_level2_approver_id_idx ON overtime_records(level2_approver_id);

-- 4. 调休申请表
CREATE TABLE IF NOT EXISTS leave_requests (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::varchar,
  employee_id VARCHAR(36) NOT NULL REFERENCES employees(id),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  hours NUMERIC(8,2) NOT NULL,
  reason TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- 选定审批人
  selected_level1_approver_id VARCHAR(36) REFERENCES employees(id),
  selected_level2_approver_id VARCHAR(36) REFERENCES employees(id),
  selected_level3_approver_id VARCHAR(36) REFERENCES employees(id),
  -- 一级审批
  level1_approver_id VARCHAR(36) REFERENCES employees(id),
  level1_approved_at TIMESTAMPTZ,
  level1_approver_name VARCHAR(50),
  level1_remark TEXT,
  -- 二级审批
  level2_approver_id VARCHAR(36) REFERENCES employees(id),
  level2_approved_at TIMESTAMPTZ,
  level2_approver_name VARCHAR(50),
  level2_remark TEXT,
  -- 三级审批
  level3_approver_id VARCHAR(36) REFERENCES employees(id),
  level3_approved_at TIMESTAMPTZ,
  level3_approver_name VARCHAR(50),
  level3_remark TEXT,
  imported BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS leave_requests_employee_id_idx ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS leave_requests_status_idx ON leave_requests(status);
CREATE INDEX IF NOT EXISTS leave_requests_start_time_idx ON leave_requests(start_time);
CREATE INDEX IF NOT EXISTS leave_requests_level1_approver_id_idx ON leave_requests(level1_approver_id);
CREATE INDEX IF NOT EXISTS leave_requests_level2_approver_id_idx ON leave_requests(level2_approver_id);

-- 5. 加班余额汇总表
CREATE TABLE IF NOT EXISTS overtime_balances (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::varchar,
  employee_id VARCHAR(36) NOT NULL REFERENCES employees(id),
  total_overtime_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
  used_leave_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
  remaining_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS overtime_balances_employee_id_idx ON overtime_balances(employee_id);

-- 6. 审批规则配置表
CREATE TABLE IF NOT EXISTS approval_rules (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::varchar,
  applicant_role VARCHAR(50) NOT NULL,
  applicant_category VARCHAR(20) NOT NULL,
  level1_approver_position VARCHAR(50) NOT NULL,
  level2_approver_position VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS approval_rules_applicant_role_idx ON approval_rules(applicant_role);
CREATE INDEX IF NOT EXISTS approval_rules_applicant_category_idx ON approval_rules(applicant_category);

-- ============================================================
-- 7. 初始管理员账号
-- 工号: admin  密码: admin123
-- password_hash 对应 bcrypt('admin123')
-- ============================================================
INSERT INTO employees (
  username, password_hash, name, role_category, position, department, is_active
) VALUES (
  'admin',
  '$2b$10$/QcrS.4kI2WShVPie/WgLupJqCOoIOXwSs62/bnVGbUkZVjodjt0a',
  '系统管理员',
  'admin',
  '系统管理员',
  '综合部',
  true
) ON CONFLICT (username) DO NOTHING;
