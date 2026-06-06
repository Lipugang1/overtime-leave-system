import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCurrentUser } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const client = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const role_category = searchParams.get('role_category');
    const position = searchParams.get('position');
    const search = searchParams.get('search');
    const module_param = searchParams.get('module');
    const squad = searchParams.get('squad');

    let query = client
      .from('employees')
      .select('id, username, name, role_category, position, department, module, squad, phone, is_active, created_at')
      .order('created_at', { ascending: false });

    if (role_category) query = query.eq('role_category', role_category);
    if (position) query = query.eq('position', position);
    if (search) query = query.or(`name.ilike.%${search}%,username.ilike.%${search}%,department.ilike.%${search}%`);
    if (module_param) query = query.eq('module', module_param);
    if (squad) query = query.eq('squad', squad);

    const { data, error } = await query;
    if (error) throw new Error(`查询失败: ${error.message}`);

    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : '查询失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
    if (user.role_category !== 'management' && user.role_category !== 'admin') {
      return NextResponse.json({ error: '无权限操作' }, { status: 403 });
    }

    const body = await request.json();
    const { username, name, role_category, position, department, module, squad, phone, password } = body;

    // Only admin can create admin users
    if (role_category === 'admin' && user.role_category !== 'admin') {
      return NextResponse.json({ error: '仅超级管理员可创建管理员账号' }, { status: 403 });
    }

    // 生产岗必须选择工班
    if (role_category === 'production' && !squad) {
      return NextResponse.json({ error: '生产岗位必须选择工班' }, { status: 400 });
    }

    if (!username || !name || !role_category || !position) {
      return NextResponse.json({ error: '请填写所有必填字段' }, { status: 400 });
    }

    const client = getSupabaseClient();

    // Hash password
    const { hashPassword } = await import('@/lib/password');
    const passwordHash = await hashPassword(password || '123456');

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
        squad: squad || null,
        phone: phone || null,
      })
      .select('id, username, name, role_category, position, department, module, squad, phone, is_active')
      .single();

    if (error) throw new Error(`创建失败: ${error.message}`);

    // Initialize balance
    await client.from('overtime_balances').insert({
      employee_id: employee.id,
      total_overtime_hours: '0',
      used_leave_hours: '0',
      remaining_hours: '0',
    });

    return NextResponse.json({ data: employee });
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
