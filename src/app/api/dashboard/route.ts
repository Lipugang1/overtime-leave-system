import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCurrentUser } from '@/lib/auth';
import { canApprove, isAdmin } from '@/lib/auth-shared';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const client = getSupabaseClient();

    // Get user's balance
    const { data: balance } = await client
      .from('overtime_balances')
      .select('total_overtime_hours, used_leave_hours, remaining_hours')
      .eq('employee_id', user.id)
      .maybeSingle();

    // Get pending approvals count for managers/admin/仓储工班长
    let pendingApprovals = 0;
    if (user.role_category === 'admin' || user.role_category === 'management' || user.position === '仓储工班长') {
      const { data: allEmployees } = await client
        .from('employees')
        .select('id, position, role_category')
        .eq('is_active', true);

      const level1Ids: string[] = [];
      const level2Ids: string[] = [];
      for (const emp of allEmployees || []) {
        if (canApprove(user.position, user.role_category, emp.position)) {
          level1Ids.push(emp.id);
        }
        if (isAdmin(user) || user.role_category === 'management') {
          level2Ids.push(emp.id);
        }
      }

      if (level1Ids.length > 0) {
        const { count: overtimeL1 } = await client
          .from('overtime_records')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending')
          .in('employee_id', level1Ids);
        const { count: leaveL1 } = await client
          .from('leave_requests')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending')
          .in('employee_id', level1Ids);
        pendingApprovals += (overtimeL1 || 0) + (leaveL1 || 0);
      }

      if (level2Ids.length > 0) {
        const { count: overtimeL2 } = await client
          .from('overtime_records')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'level1_approved')
          .in('employee_id', level2Ids);
        const { count: leaveL2 } = await client
          .from('leave_requests')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'level1_approved')
          .in('employee_id', level2Ids);
        pendingApprovals += (overtimeL2 || 0) + (leaveL2 || 0);
      }
    }

    // Get my recent overtime records
    const { data: recentOvertime } = await client
      .from('overtime_records')
      .select('*')
      .eq('employee_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);

    // Get my recent leave requests
    const { data: recentLeave } = await client
      .from('leave_requests')
      .select('*')
      .eq('employee_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);

    // Get total employee count
    const { count: totalEmployees } = await client
      .from('employees')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    return NextResponse.json({
      balance: balance || { total_overtime_hours: '0', used_leave_hours: '0', remaining_hours: '0' },
      pendingApprovals,
      recentOvertime: recentOvertime || [],
      recentLeave: recentLeave || [],
      totalEmployees: totalEmployees || 0,
      user,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '查询失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
