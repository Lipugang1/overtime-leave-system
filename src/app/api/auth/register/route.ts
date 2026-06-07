import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { hashPassword } from '@/lib/password';
import { createToken, type AuthUser, POSITION_OPTIONS, REGISTER_ROLE_LABELS } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { username, password, name, role_category, position, department, module, phone, squad } = await request.json();

    // Block admin registration through public page
    if (role_category === 'admin') {
      return NextResponse.json({ error: '超级管理员账号不能通过注册页面创建，请联系系统管理员' }, { status: 403 });
    }

    // Validate role_category - only non-admin roles allowed
    if (!REGISTER_ROLE_LABELS[role_category]) {
      return NextResponse.json({ error: '无效的角色分类' }, { status: 400 });
    }

    if (!username || !password || !name || !role_category || !position) {
      return NextResponse.json({ error: '请填写所有必填字段' }, { status: 400 });
    }

    // Squad is required for production roles
    if (role_category === 'production' && !squad) {
      return NextResponse.json({ error: '生产岗必须选择工班' }, { status: 400 });
    }

    const validPositions = POSITION_OPTIONS[role_category] || [];
    if (validPositions.length === 0 || !validPositions.includes(position)) {
      return NextResponse.json({ error: '岗位与角色分类不匹配' }, { status: 400 });
    }

    const client = getSupabaseClient();

    // Check if username (工号) already exists
    const { data: existing } = await client
      .from('employees')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: '该工号已存在' }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);

    const { data: employee, error } = await client
      .from('employees')
      .insert({
        username,
        password_hash: passwordHash,
        name,
        role_category,
        position,
        department: department || null,
        module: module || null,
        phone: phone || null,
        squad: role_category === 'production' ? (squad || null) : null,
      })
      .select('id, username, name, role_category, position, department, module, squad')
      .single();

    if (error) throw new Error(`注册失败: ${error.message}`);

    // Initialize balance
    await client.from('overtime_balances').insert({
      employee_id: employee.id,
      total_overtime_hours: '0',
      used_leave_hours: '0',
      remaining_hours: '0',
    });

    const authUser: AuthUser = {
      id: employee.id,
      username: employee.username,
      name: employee.name,
      role_category: employee.role_category,
      position: employee.position,
      department: employee.department,
      module: employee.module,
      squad: employee.squad,
    };

    const token = await createToken(authUser);

    const response = NextResponse.json({ user: authUser, token });
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : '注册失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
