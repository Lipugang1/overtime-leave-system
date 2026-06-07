import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { isAdmin } from '@/lib/auth-shared';
import { getSupabaseClient } from '@/storage/database/supabase-client';
/**
 * GET /api/overtime/export - 导出加班台账
 * 管理员可选日期范围
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    const supabase = getSupabaseClient();
    let query = supabase
      .from('overtime_records')
      .select('*, employee:employees!overtime_records_employee_id_fkey(name, username, position, department, module), level1_approver:employees!overtime_records_level1_approver_id_fkey(name), level2_approver:employees!overtime_records_level2_approver_id_fkey(name)')
      .order('created_at', { ascending: false });

    if (isAdmin(user)) {
      // 超级管理员导出全部
    } else {
      // 非管理员只导出自己的加班记录
      query = query.eq('employee_id', user.id);
    }

    if (startDate) query = query.gte('start_time', startDate);
    if (endDate) query = query.lte('start_time', endDate + 'T23:59:59');

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: '导出失败' }, { status: 500 });
    }

    const statusLabels: Record<string, string> = {
      pending: '待审批',
      level1_approved: '一级已批',
      level2_approved: '二级已批',
      approved: '已通过',
      rejected: '已驳回',
    };

    // 生成CSV
    const headers = ['工号', '姓名', '岗位', '部门', '模块', '加班日期', '开始时间', '结束时间', '工时(小时)', '说明', '状态', '一级审批人', '二级审批人'];
    const rows = (data || []).map((r: Record<string, unknown>) => [
      (r.employee as Record<string, string>)?.username || '',
      (r.employee as Record<string, string>)?.name || '',
      (r.employee as Record<string, string>)?.position || '',
      (r.employee as Record<string, string>)?.department || '',
      (r.employee as Record<string, string>)?.module || '',
      r.overtime_date || '',
      r.start_time ? new Date(r.start_time as string).toLocaleString('zh-CN') : '',
      r.end_time ? new Date(r.end_time as string).toLocaleString('zh-CN') : '',
      r.hours || '',
      r.description || '',
      statusLabels[r.status as string] || r.status,
      (r.level1_approver as Record<string, string>)?.name || r.level1_approver_name || '',
      (r.level2_approver as Record<string, string>)?.name || r.level2_approver_name || '',
    ]);

    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const bom = '\uFEFF';
    const csvBuffer = Buffer.from(bom + csvContent, 'utf-8');

    return new NextResponse(csvBuffer, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename=overtime_export_${new Date().toISOString().split('T')[0]}.csv`,
      },
    });
  } catch (error) {
    console.error('Export overtime error:', error);
    return NextResponse.json({ error: '导出失败' }, { status: 500 });
  }
}
