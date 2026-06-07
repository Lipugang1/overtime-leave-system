import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { isAdmin } from '@/lib/auth-shared';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PUT /api/overtime/[id] - 审批/编辑加班记录
 */
export async function PUT(request: Request, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { action } = body;

    const supabase = getSupabaseClient();

    // 获取当前记录
    const { data: record, error: fetchError } = await supabase
      .from('overtime_records')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !record) {
      return NextResponse.json({ error: '记录不存在' }, { status: 404 });
    }

    // ===== 撤回操作（员工撤回自己未审批的记录）=====
    if (action === 'withdraw') {
      if (record.employee_id !== user.id && !isAdmin(user)) {
        return NextResponse.json({ error: '只能撤回自己提交的加班记录' }, { status: 403 });
      }
      if (record.status !== 'pending') {
        return NextResponse.json({ error: '只能撤回待审批的加班记录' }, { status: 400 });
      }
      const { data, error } = await supabase
        .from('overtime_records')
        .update({
          status: 'withdrawn',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) return NextResponse.json({ error: '撤回失败' }, { status: 500 });
      return NextResponse.json({ data });
    }

    // ===== 编辑操作 =====
    if (action === 'edit') {
      const isOwner = record.employee_id === user.id;
      const isUserAdmin = isAdmin(user);

      // 管理员可编辑任何记录；员工只能编辑自己未审批的记录
      if (!isUserAdmin && !isOwner) {
        return NextResponse.json({ error: '无权编辑此加班记录' }, { status: 403 });
      }
      if (!isUserAdmin && record.status !== 'pending') {
        return NextResponse.json({ error: '只能编辑待审批的加班记录' }, { status: 400 });
      }

      const updateData: Record<string, unknown> = {};
      if (body.overtime_date) updateData.overtime_date = body.overtime_date;
      if (body.start_time !== undefined) updateData.start_time = body.start_time;
      if (body.end_time !== undefined) updateData.end_time = body.end_time;
      if (body.hours) updateData.hours = String(body.hours);
      if (body.description !== undefined) updateData.description = body.description;
      updateData.updated_at = new Date().toISOString();

      // 员工编辑时，重置审批人（因为工时可能变化导致审批级别改变）
      if (isOwner && !isUserAdmin) {
        if (body.selected_level1_approver_id !== undefined) updateData.selected_level1_approver_id = body.selected_level1_approver_id;
        if (body.selected_level2_approver_id !== undefined) updateData.selected_level2_approver_id = body.selected_level2_approver_id;
        if (body.selected_level3_approver_id !== undefined) updateData.selected_level3_approver_id = body.selected_level3_approver_id;
      }

      // 管理员编辑已审批通过的记录时，需要更新余额
      if (isUserAdmin && body.hours && (record.status === 'approved')) {
        const diff = parseFloat(String(body.hours)) - parseFloat(record.hours);
        if (diff !== 0) {
          const { data: balance } = await supabase
            .from('overtime_balances')
            .select('*')
            .eq('employee_id', record.employee_id)
            .single();
          if (balance) {
            const newTotal = parseFloat(balance.total_overtime_hours) + diff;
            const newRemaining = newTotal - parseFloat(balance.used_leave_hours);
            await supabase
              .from('overtime_balances')
              .update({
                total_overtime_hours: String(Math.max(0, newTotal)),
                remaining_hours: String(Math.max(0, newRemaining)),
                updated_at: new Date().toISOString(),
              })
              .eq('employee_id', record.employee_id);
          }
        }
      }

      const { data, error } = await supabase
        .from('overtime_records')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: '编辑失败' }, { status: 500 });
      }
      return NextResponse.json({ data });
    }

    // ===== 审批操作 =====
    const isUserAdmin = isAdmin(user);

    if (action === 'level1_approve') {
      // 一级审批
      if (record.status !== 'pending') {
        return NextResponse.json({ error: '当前状态不允许一级审批' }, { status: 400 });
      }
      // 检查是否是指定审批人或管理员
      if (!isUserAdmin && record.selected_level1_approver_id && record.selected_level1_approver_id !== user.id) {
        return NextResponse.json({ error: '您不是该记录的一级审批人' }, { status: 403 });
      }
      const { data, error } = await supabase
        .from('overtime_records')
        .update({
          status: 'level1_approved',
          level1_approver_id: user.id,
          level1_approver_name: user.name,
          level1_approved_at: new Date().toISOString(),
          level1_remark: body.remark || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) return NextResponse.json({ error: '审批失败' }, { status: 500 });
      // 如果只需一级审批，直接标记为approved并更新余额
      if (!record.selected_level2_approver_id && !record.selected_level3_approver_id) {
        await supabase
          .from('overtime_records')
          .update({
            status: 'approved',
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);
        await updateOvertimeBalance(supabase, record.employee_id, parseFloat(record.hours));
        const { data: finalData } = await supabase.from('overtime_records').select().eq('id', id).single();
        return NextResponse.json({ data: finalData });
      }
      return NextResponse.json({ data });
    }

    if (action === 'level2_approve') {
      if (record.status !== 'level1_approved') {
        return NextResponse.json({ error: '当前状态不允许二级审批' }, { status: 400 });
      }
      if (!isUserAdmin && record.selected_level2_approver_id && record.selected_level2_approver_id !== user.id) {
        return NextResponse.json({ error: '您不是该记录的二级审批人' }, { status: 403 });
      }
      const { data, error } = await supabase
        .from('overtime_records')
        .update({
          status: 'level2_approved',
          level2_approver_id: user.id,
          level2_approver_name: user.name,
          level2_approved_at: new Date().toISOString(),
          level2_remark: body.remark || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) return NextResponse.json({ error: '审批失败' }, { status: 500 });
      // 如果没有三级审批人，直接approved
      if (!record.selected_level3_approver_id) {
        await supabase
          .from('overtime_records')
          .update({ status: 'approved', updated_at: new Date().toISOString() })
          .eq('id', id);
        await updateOvertimeBalance(supabase, record.employee_id, parseFloat(record.hours));
        const { data: finalData } = await supabase.from('overtime_records').select().eq('id', id).single();
        return NextResponse.json({ data: finalData });
      }
      return NextResponse.json({ data });
    }

    if (action === 'level3_approve') {
      if (record.status !== 'level2_approved') {
        return NextResponse.json({ error: '当前状态不允许三级审批' }, { status: 400 });
      }
      if (!isUserAdmin && record.selected_level3_approver_id && record.selected_level3_approver_id !== user.id) {
        return NextResponse.json({ error: '您不是该记录的三级审批人' }, { status: 403 });
      }
      const { data, error } = await supabase
        .from('overtime_records')
        .update({
          status: 'approved',
          level3_approver_id: user.id,
          level3_approver_name: user.name,
          level3_approved_at: new Date().toISOString(),
          level3_remark: body.remark || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) return NextResponse.json({ error: '审批失败' }, { status: 500 });
      await updateOvertimeBalance(supabase, record.employee_id, parseFloat(record.hours));
      return NextResponse.json({ data });
    }

    if (action === 'reject') {
      if (!['pending', 'level1_approved', 'level2_approved'].includes(record.status)) {
        return NextResponse.json({ error: '当前状态不允许驳回' }, { status: 400 });
      }
      const rejectData: Record<string, unknown> = {
        status: 'rejected',
        updated_at: new Date().toISOString(),
      };
      // 根据当前状态记录驳回人
      if (record.status === 'pending') {
        rejectData.level1_approver_id = user.id;
        rejectData.level1_approver_name = user.name;
        rejectData.level1_remark = body.remark || '驳回';
      } else if (record.status === 'level1_approved') {
        rejectData.level2_approver_id = user.id;
        rejectData.level2_approver_name = user.name;
        rejectData.level2_remark = body.remark || '驳回';
      } else if (record.status === 'level2_approved') {
        rejectData.level3_approver_id = user.id;
        rejectData.level3_approver_name = user.name;
        rejectData.level3_remark = body.remark || '驳回';
      }

      const { data, error } = await supabase
        .from('overtime_records')
        .update(rejectData)
        .eq('id', id)
        .select()
        .single();

      if (error) return NextResponse.json({ error: '驳回失败' }, { status: 500 });
      return NextResponse.json({ data });
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (error) {
    console.error('Overtime action error:', error);
    return NextResponse.json({ error: '操作失败' }, { status: 500 });
  }
}

/**
 * DELETE /api/overtime/[id] - 删除加班记录（仅管理员）
 */
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }
    if (!isAdmin(user)) {
      return NextResponse.json({ error: '仅管理员可删除加班记录' }, { status: 403 });
    }

    const { id } = await context.params;
    const supabase = getSupabaseClient();

    const { data: record, error: fetchError } = await supabase
      .from('overtime_records')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !record) {
      return NextResponse.json({ error: '记录不存在' }, { status: 404 });
    }

    // 如果已审批通过，需要回退余额
    if (record.status === 'approved') {
      const { data: balance } = await supabase
        .from('overtime_balances')
        .select('*')
        .eq('employee_id', record.employee_id)
        .single();

      if (balance) {
        const newTotal = parseFloat(balance.total_overtime_hours) - parseFloat(record.hours);
        const newRemaining = newTotal - parseFloat(balance.used_leave_hours);
        await supabase
          .from('overtime_balances')
          .update({
            total_overtime_hours: String(Math.max(0, newTotal)),
            remaining_hours: String(Math.max(0, newRemaining)),
            updated_at: new Date().toISOString(),
          })
          .eq('employee_id', record.employee_id);
      }
    }

    const { error } = await supabase
      .from('overtime_records')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: '删除失败' }, { status: 500 });
    }

    return NextResponse.json({ message: '删除成功' });
  } catch (error) {
    console.error('Delete overtime error:', error);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}

/**
 * 更新加班余额
 */
async function updateOvertimeBalance(supabase: ReturnType<typeof getSupabaseClient>, employeeId: string, hours: number) {
  const { data: balance } = await supabase
    .from('overtime_balances')
    .select('*')
    .eq('employee_id', employeeId)
    .single();

  if (balance) {
    const newTotal = parseFloat(balance.total_overtime_hours) + hours;
    const newRemaining = newTotal - parseFloat(balance.used_leave_hours);
    await supabase
      .from('overtime_balances')
      .update({
        total_overtime_hours: String(Math.max(0, newTotal)),
        remaining_hours: String(Math.max(0, newRemaining)),
        updated_at: new Date().toISOString(),
      })
      .eq('employee_id', employeeId);
  } else {
    await supabase
      .from('overtime_balances')
      .insert({
        employee_id: employeeId,
        total_overtime_hours: String(Math.max(0, hours)),
        used_leave_hours: '0',
        remaining_hours: String(Math.max(0, hours)),
      });
  }
}
