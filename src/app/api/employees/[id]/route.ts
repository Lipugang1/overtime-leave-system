import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCurrentUser } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const { id } = await params;
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('employees')
      .select('id, username, name, role_category, position, department, module, squad, phone, is_active, created_at')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(`查询失败: ${error.message}`);
    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : '查询失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const isManagement = user.role_category === 'management' || user.role_category === 'admin';
    const isSelf = user.id === id;

    // Only management or self can edit
    if (!isManagement && !isSelf) {
      return NextResponse.json({ error: '无权限操作' }, { status: 403 });
    }

    const client = getSupabaseClient();
    const updateData: Record<string, unknown> = {};

    if (isManagement) {
      // Management can edit all fields, but only admin can set admin role
      if (body.name !== undefined) updateData.name = body.name;
      if (body.role_category !== undefined) {
        if (body.role_category === 'admin' && user.role_category !== 'admin') {
          return NextResponse.json({ error: '仅超级管理员可设置管理员角色' }, { status: 403 });
        }
        updateData.role_category = body.role_category;
      }
      if (body.position !== undefined) updateData.position = body.position;
      if (body.department !== undefined) updateData.department = body.department;
      if (body.module !== undefined) updateData.module = body.module;
      if (body.squad !== undefined) updateData.squad = body.squad;
      if (body.phone !== undefined) updateData.phone = body.phone;
      if (body.is_active !== undefined) updateData.is_active = body.is_active;

      if (body.password) {
        const { hashPassword } = await import('@/lib/password');
        updateData.password_hash = await hashPassword(body.password);
      }
    } else if (isSelf) {
      // Self can only edit name, phone, department, module
      if (body.name !== undefined) updateData.name = body.name;
      if (body.phone !== undefined) updateData.phone = body.phone;
      if (body.department !== undefined) updateData.department = body.department;
      if (body.module !== undefined) updateData.module = body.module;
      if (body.squad !== undefined) updateData.squad = body.squad;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: '没有需要更新的字段' }, { status: 400 });
    }

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await client
      .from('employees')
      .update(updateData)
      .eq('id', id)
      .select('id, username, name, role_category, position, department, module, squad, phone, is_active')
      .single();

    if (error) throw new Error(`更新失败: ${error.message}`);
    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : '更新失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
    if (user.role_category !== 'admin') {
      return NextResponse.json({ error: '仅系统管理员可删除人员' }, { status: 403 });
    }

    const { id } = await params;

    // 不允许删除自己
    if (id === user.id) {
      return NextResponse.json({ error: '不能删除自己的账号' }, { status: 400 });
    }

    const client = getSupabaseClient();

    // 先删除关联的工时余额记录
    await client.from('overtime_balances').delete().eq('employee_id', id);

    // 删除关联的加班记录（审批人关联）
    await client.from('overtime_records').delete().eq('employee_id', id);
    // 清除作为审批人的关联字段
    await client.from('overtime_records').update({
      level1_approver_id: null,
      level1_approver_name: null,
    }).eq('level1_approver_id', id);
    await client.from('overtime_records').update({
      level2_approver_id: null,
      level2_approver_name: null,
    }).eq('level2_approver_id', id);
    await client.from('overtime_records').update({
      level3_approver_id: null,
      level3_approver_name: null,
    }).eq('level3_approver_id', id);

    // 删除关联的调休记录
    await client.from('leave_requests').delete().eq('employee_id', id);
    // 清除作为审批人的关联字段
    await client.from('leave_requests').update({
      level1_approver_id: null,
      level1_approver_name: null,
    }).eq('level1_approver_id', id);
    await client.from('leave_requests').update({
      level2_approver_id: null,
      level2_approver_name: null,
    }).eq('level2_approver_id', id);
    await client.from('leave_requests').update({
      level3_approver_id: null,
      level3_approver_name: null,
    }).eq('level3_approver_id', id);

    // 删除员工记录
    const { error } = await client
      .from('employees')
      .delete()
      .eq('id', id);

    if (error) throw new Error(`删除失败: ${error.message}`);
    return NextResponse.json({ message: '已删除该人员及相关数据' });
  } catch (err) {
    const message = err instanceof Error ? err.message : '删除失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
