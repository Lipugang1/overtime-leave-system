import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { isAdmin, isManagerial } from '@/lib/auth-shared';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export const runtime = 'nodejs';

/**
 * GET /api/approval - 获取审批列表（含待审批和历史记录）
 * 参数: status_filter=pending|approved|rejected|all (默认pending)
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    // 非管理岗位和管理员不能审批
    if (!isAdmin(user) && !isManagerial(user) && user.position !== '仓储工班长') {
      return NextResponse.json({ data: [], total: 0 });
    }

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status_filter') || 'pending';

    const supabase = getSupabaseClient();

    // 获取加班记录
    let overtimeQuery = supabase
      .from('overtime_records')
      .select('*, employee:employees!overtime_records_employee_id_fkey(id, name, username, position, department, module, squad), level1_approver:employees!overtime_records_level1_approver_id_fkey(id, name), level2_approver:employees!overtime_records_level2_approver_id_fkey(id, name), level3_approver:employees!overtime_records_level3_approver_id_fkey(id, name), selected_level1:employees!overtime_records_selected_level1_approver_id_fkey(id, name), selected_level2:employees!overtime_records_selected_level2_approver_id_fkey(id, name), selected_level3:employees!overtime_records_selected_level3_approver_id_fkey(id, name)')
      .order('created_at', { ascending: false });

    let leaveQuery = supabase
      .from('leave_requests')
      .select('*, employee:employees!leave_requests_employee_id_fkey(id, name, username, position, department, module, squad), level1_approver:employees!leave_requests_level1_approver_id_fkey(id, name), level2_approver:employees!leave_requests_level2_approver_id_fkey(id, name), level3_approver:employees!leave_requests_level3_approver_id_fkey(id, name), selected_level1:employees!leave_requests_selected_level1_approver_id_fkey(id, name), selected_level2:employees!leave_requests_selected_level2_approver_id_fkey(id, name), selected_level3:employees!leave_requests_selected_level3_approver_id_fkey(id, name)')
      .order('created_at', { ascending: false });

    // 根据状态过滤
    if (statusFilter === 'pending') {
      // 待审批：仅显示需要当前用户处理的
      if (isAdmin(user)) {
        overtimeQuery = overtimeQuery.in('status', ['pending', 'level1_approved', 'level2_approved']);
        leaveQuery = leaveQuery.in('status', ['pending', 'level1_approved', 'level2_approved']);
      } else {
        overtimeQuery = overtimeQuery.or(
          `and(status.eq.pending,selected_level1_approver_id.eq.${user.id}),and(status.eq.level1_approved,selected_level2_approver_id.eq.${user.id}),and(status.eq.level2_approved,selected_level3_approver_id.eq.${user.id})`
        );
        leaveQuery = leaveQuery.or(
          `and(status.eq.pending,selected_level1_approver_id.eq.${user.id}),and(status.eq.level1_approved,selected_level2_approver_id.eq.${user.id}),and(status.eq.level2_approved,selected_level3_approver_id.eq.${user.id})`
        );
      }
    } else if (statusFilter === 'approved') {
      // 已通过：显示当前用户参与过审批的
      overtimeQuery = overtimeQuery.eq('status', 'approved');
      leaveQuery = leaveQuery.eq('status', 'approved');
      if (!isAdmin(user)) {
        overtimeQuery = overtimeQuery.or(`level1_approver_id.eq.${user.id},level2_approver_id.eq.${user.id},level3_approver_id.eq.${user.id}`);
        leaveQuery = leaveQuery.or(`level1_approver_id.eq.${user.id},level2_approver_id.eq.${user.id},level3_approver_id.eq.${user.id}`);
      }
    } else if (statusFilter === 'rejected') {
      // 已驳回
      overtimeQuery = overtimeQuery.eq('status', 'rejected');
      leaveQuery = leaveQuery.eq('status', 'rejected');
      if (!isAdmin(user)) {
        overtimeQuery = overtimeQuery.or(`level1_approver_id.eq.${user.id},level2_approver_id.eq.${user.id},level3_approver_id.eq.${user.id}`);
        leaveQuery = leaveQuery.or(`level1_approver_id.eq.${user.id},level2_approver_id.eq.${user.id},level3_approver_id.eq.${user.id}`);
      }
    } else {
      // all: 显示所有当前用户参与过的（审批人 + 审批过的人）
      if (isAdmin(user)) {
        // 管理员看全部
      } else {
        overtimeQuery = overtimeQuery.or(`selected_level1_approver_id.eq.${user.id},selected_level2_approver_id.eq.${user.id},selected_level3_approver_id.eq.${user.id},level1_approver_id.eq.${user.id},level2_approver_id.eq.${user.id},level3_approver_id.eq.${user.id}`);
        leaveQuery = leaveQuery.or(`selected_level1_approver_id.eq.${user.id},selected_level2_approver_id.eq.${user.id},selected_level3_approver_id.eq.${user.id},level1_approver_id.eq.${user.id},level2_approver_id.eq.${user.id},level3_approver_id.eq.${user.id}`);
      }
    }

    const [overtimeResult, leaveResult] = await Promise.all([overtimeQuery, leaveQuery]);

    const items = [];

    for (const o of (overtimeResult.data || [])) {
      let approvalLevel = 0;
      let approvalLabel = '';
      if (o.status === 'pending') {
        approvalLevel = 1;
        approvalLabel = '一级审批';
      } else if (o.status === 'level1_approved') {
        approvalLevel = 2;
        approvalLabel = '二级审批';
      } else if (o.status === 'level2_approved') {
        approvalLevel = 3;
        approvalLabel = '三级审批';
      } else if (o.status === 'approved') {
        approvalLevel = 0;
        approvalLabel = '已通过';
      } else if (o.status === 'rejected') {
        approvalLevel = 0;
        approvalLabel = '已驳回';
      }
      items.push({
        id: o.id,
        type: 'overtime' as const,
        type_label: '加班',
        employee_id: o.employee?.id,
        employee_name: o.employee?.name,
        employee_position: o.employee?.position,
        employee_department: o.employee?.department,
        date: o.overtime_date,
        start_time: o.start_time,
        end_time: o.end_time,
        hours: parseFloat(o.hours),
        description: o.description,
        status: o.status,
        approval_level: approvalLevel,
        approval_label: approvalLabel,
        selected_level1: o.selected_level1?.name,
        selected_level2: o.selected_level2?.name,
        selected_level3: o.selected_level3?.name,
        level1_approver_name: o.level1_approver?.name || o.level1_approver_name,
        level2_approver_name: o.level2_approver?.name || o.level2_approver_name,
        level3_approver_name: o.level3_approver?.name || o.level3_approver_name,
        created_at: o.created_at,
      });
    }

    for (const l of (leaveResult.data || [])) {
      let approvalLevel = 0;
      let approvalLabel = '';
      if (l.status === 'pending') {
        approvalLevel = 1;
        approvalLabel = '一级审批';
      } else if (l.status === 'level1_approved') {
        approvalLevel = 2;
        approvalLabel = '二级审批';
      } else if (l.status === 'level2_approved') {
        approvalLevel = 3;
        approvalLabel = '三级审批';
      } else if (l.status === 'approved') {
        approvalLevel = 0;
        approvalLabel = '已通过';
      } else if (l.status === 'rejected') {
        approvalLevel = 0;
        approvalLabel = '已驳回';
      }
      items.push({
        id: l.id,
        type: 'leave' as const,
        type_label: '调休',
        employee_id: l.employee?.id,
        employee_name: l.employee?.name,
        employee_position: l.employee?.position,
        employee_department: l.employee?.department,
        start_time: l.start_time,
        end_time: l.end_time,
        hours: parseFloat(l.hours),
        reason: l.reason,
        status: l.status,
        approval_level: approvalLevel,
        approval_label: approvalLabel,
        selected_level1: l.selected_level1?.name,
        selected_level2: l.selected_level2?.name,
        selected_level3: l.selected_level3?.name,
        level1_approver_name: l.level1_approver?.name || l.level1_approver_name,
        level2_approver_name: l.level2_approver?.name || l.level2_approver_name,
        level3_approver_name: l.level3_approver?.name || l.level3_approver_name,
        created_at: l.created_at,
      });
    }

    // 按创建时间排序
    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({ data: items, total: items.length });
  } catch (error) {
    console.error('Get approval error:', error);
    return NextResponse.json({ error: '获取审批列表失败' }, { status: 500 });
  }
}
