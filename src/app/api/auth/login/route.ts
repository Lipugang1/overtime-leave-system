import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { verifyPassword } from '@/lib/password';
import { createToken, type AuthUser } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();
    if (!username || !password) {
      return NextResponse.json({ error: '请输入工号和密码' }, { status: 400 });
    }

    const client = getSupabaseClient();
    const { data: employee, error } = await client
      .from('employees')
      .select('id, username, name, role_category, position, department, module, squad, password_hash, is_active')
      .eq('username', username)
      .maybeSingle();

    if (error) throw new Error(`查询失败: ${error.message}`);
    if (!employee) {
      return NextResponse.json({ error: '工号或密码错误' }, { status: 401 });
    }
    if (!employee.is_active) {
      return NextResponse.json({ error: '账号已被禁用' }, { status: 403 });
    }

    const valid = await verifyPassword(password, employee.password_hash);
    if (!valid) {
      return NextResponse.json({ error: '工号或密码错误' }, { status: 401 });
    }

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
    // Also set cookie as fallback
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : '登录失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
