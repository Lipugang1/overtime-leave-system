import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { isAdmin } from '@/lib/auth-shared';
import { getApprovalRule } from '@/lib/auth-shared';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export const runtime = 'nodejs';

/**
 * POST /api/leave - 创建调休申请
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const body = await request.json();
    const { employee_id, start_time, end_time, hours, reason,
            selected_level1_approver_id, selected_level2_approver_id, selected_level3_approver_id } = body;

    const targetEmployeeId = (isAdmin(user) && employee_id) ? employee_id : user.id;

    if (!start_time || !end_time || !hours) {
      return NextResponse.json({ error: '起止时间和工时为必填项' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // 获取目标员工信息
    const { data: targetEmployee, error: empError } = await supabase
      .from('employees')
      .select('id, position, role_category')
      .eq('id', targetEmployeeId)
      .single();

    if (empError || !targetEmployee) {
      return NextResponse.json({ error: '员工不存在' }, { status: 404 });
    }

    // 非管理员必须选择审批人（仅当系统中存在可选审批人时）
    if (!isAdmin(user) && !selected_level1_approver_id) {
      const rule = getApprovalRule(targetEmployee.position, parseFloat(String(hours)), true);
      if (rule.level1Approvers.length > 0) {
        const { data: availableApprovers } = await supabase
          .from('employees')
          .select('id')
          .in('position', rule.level1Approvers)
          .eq('is_active', true)
          .limit(1);
        if (availableApprovers && availableApprovers.length > 0) {
          return NextResponse.json({ error: '请选择审批人' }, { status: 400 });
        }
      }
    }

    // 检查余额
    const { data: balance } = await supabase
      .from('overtime_balances')
      .select('*')
      .eq('employee_id', targetEmployeeId)
      .single();

    const remaining = balance ? parseFloat(balance.remaining_hours) : 0;
    if (remaining < parseFloat(String(hours))) {
      return NextResponse.json({ error: `调休工时不足，当前余额: ${remaining}小时` }, { status: 400 });
    }

    // 验证审批人选择是否合规
    const rule = getApprovalRule(targetEmployee.position, parseFloat(String(hours)), true);
    if (selected_level1_approver_id && rule.level1Approvers.length > 0) {
      const { data: l1Approver } = await supabase
        .from('employees')
        .select('position')
        .eq('id', selected_level1_approver_id)
        .single();
      if (l1Approver && !rule.level1Approvers.includes(l1Approver.position)) {
        return NextResponse.json({ error: '一级审批人选择不合规' }, { status: 400 });
      }
    }

    const record: Record<string, unknown> = {
      employee_id: targetEmployeeId,
      start_time,
      end_time,
      hours: String(hours),
      reason: reason || null,
      status: 'pending',
      imported: false,
    };

    if (selected_level1_approver_id) record.selected_level1_approver_id = selected_level1_approver_id;
    if (selected_level2_approver_id) record.selected_level2_approver_id = selected_level2_approver_id;
    if (selected_level3_approver_id) record.selected_level3_approver_id = selected_level3_approver_id;

    const { data, error } = await supabase
      .from('leave_requests')
      .insert(record)
      .select()
      .single();

    if (error) {
      console.error('Create leave error:', JSON.stringify(error));
      return NextResponse.json({ error: '创建调休申请失败' }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Create leave error:', error);
    return NextResponse.json({ error: '创建调休申请失败' }, { status: 500 });
  }
}

/**
 * GET /api/leave - 查询调休记录
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('page_size') || '20');
    const status = searchParams.get('status');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    const supabase = getSupabaseClient();
    let query = supabase
      .from('leave_requests')
      .select('*, employee:employees!leave_requests_employee_id_fkey(id, name, username, position, department, module), level1_approver:employees!leave_requests_level1_approver_id_fkey(id, name), level2_approver:employees!leave_requests_level2_approver_id_fkey(id, name), level3_approver:employees!leave_requests_level3_approver_id_fkey(id, name), selected_level1:employees!leave_requests_selected_level1_approver_id_fkey(id, name), selected_level2:employees!leave_requests_selected_level2_approver_id_fkey(id, name), selected_level3:employees!leave_requests_selected_level3_approver_id_fkey(id, name)', { count: 'exact' })
      .order('created_at', { ascending: false });

    // 权限过滤：调休管理页面只看自己的记录（管理岗和工班长也需要自己申请调休）
    if (isAdmin(user)) {
      // 超级管理员看全部
    } else {
      // 所有非管理员用户只看自己的调休记录
      query = query.eq('employee_id', user.id);
    }

    if (status) query = query.eq('status', status);
    if (startDate) query = query.gte('start_time', startDate);
    if (endDate) query = query.lte('end_time', endDate + 'T23:59:59');

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, count, error } = await query.range(from, to);

    if (error) {
      console.error('Get leave error:', error);
      return NextResponse.json({ error: '查询调休记录失败' }, { status: 500 });
    }

    return NextResponse.json({
      data,
      total: count,
      page,
      page_size: pageSize,
    });
  } catch (error) {
    console.error('Get leave error:', error);
    return NextResponse.json({ error: '查询调休记录失败' }, { status: 500 });
  }
}
