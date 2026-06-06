import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { isAdmin, getApprovalRule } from '@/lib/auth-shared';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/**
 * POST /api/overtime - 创建加班记录
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const body = await request.json();
    const { employee_id, overtime_date, start_time, end_time, hours, description,
            selected_level1_approver_id, selected_level2_approver_id, selected_level3_approver_id } = body;

    // 管理员可代登记，普通用户只能为自己登记
    const targetEmployeeId = (isAdmin(user) && employee_id) ? employee_id : user.id;

    // 支持时间段模式和日期模式
    if (!hours) {
      return NextResponse.json({ error: '加班工时为必填项' }, { status: 400 });
    }
    if (!start_time && !overtime_date) {
      return NextResponse.json({ error: '加班时间或日期为必填项' }, { status: 400 });
    }
    if (!start_time || !end_time) {
      return NextResponse.json({ error: '开始时间和结束时间为必填项' }, { status: 400 });
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
      const rule = getApprovalRule(targetEmployee.position, parseFloat(String(hours)), false);
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

    // 构建记录
    const record: Record<string, unknown> = {
      employee_id: targetEmployeeId,
      hours: String(hours),
      description: description || null,
      status: 'pending',
      imported: false,
    };

    // 日期/时间段
    if (overtime_date) record.overtime_date = overtime_date;
    if (start_time) record.start_time = start_time;
    if (end_time) record.end_time = end_time;

    // 选定审批人
    if (selected_level1_approver_id) record.selected_level1_approver_id = selected_level1_approver_id;
    if (selected_level2_approver_id) record.selected_level2_approver_id = selected_level2_approver_id;
    if (selected_level3_approver_id) record.selected_level3_approver_id = selected_level3_approver_id;

    const { data, error } = await supabase
      .from('overtime_records')
      .insert(record)
      .select()
      .single();

    if (error) {
      console.error('Create overtime error:', JSON.stringify(error));
      return NextResponse.json({ error: '创建加班记录失败', detail: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Create overtime error:', error);
    return NextResponse.json({ error: '创建加班记录失败' }, { status: 500 });
  }
}

/**
 * GET /api/overtime - 查询加班记录
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
      .from('overtime_records')
      .select('*, employee:employees!overtime_records_employee_id_fkey(id, name, username, position, department, module), level1_approver:employees!overtime_records_level1_approver_id_fkey(id, name), level2_approver:employees!overtime_records_level2_approver_id_fkey(id, name), level3_approver:employees!overtime_records_level3_approver_id_fkey(id, name), selected_level1:employees!overtime_records_selected_level1_approver_id_fkey(id, name), selected_level2:employees!overtime_records_selected_level2_approver_id_fkey(id, name), selected_level3:employees!overtime_records_selected_level3_approver_id_fkey(id, name)', { count: 'exact' })
      .order('created_at', { ascending: false });

    // 权限过滤：加班管理页面只看自己的记录（管理岗和工班长也需要自己登记加班）
    if (isAdmin(user)) {
      // 超级管理员看全部
    } else {
      // 所有非管理员用户只看自己的加班记录
      query = query.eq('employee_id', user.id);
    }

    if (status) query = query.eq('status', status);
    if (startDate) query = query.gte('overtime_date', startDate);
    if (endDate) query = query.lte('overtime_date', endDate);

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, count, error } = await query.range(from, to);

    if (error) {
      console.error('Get overtime error:', error);
      return NextResponse.json({ error: '查询加班记录失败' }, { status: 500 });
    }

    return NextResponse.json({
      data,
      total: count,
      page,
      page_size: pageSize,
    });
  } catch (error) {
    console.error('Get overtime error:', error);
    return NextResponse.json({ error: '查询加班记录失败' }, { status: 500 });
  }
}
