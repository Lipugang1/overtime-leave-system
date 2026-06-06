import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { hashPassword, verifyPassword } from '@/lib/password';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const body = await request.json();
    const { old_password, new_password } = body;

    if (!old_password || !new_password) {
      return NextResponse.json({ error: '请填写旧密码和新密码' }, { status: 400 });
    }

    if (new_password.length < 4) {
      return NextResponse.json({ error: '新密码长度不能少于4位' }, { status: 400 });
    }

    const client = getSupabaseClient();

    // Get current password hash
    const { data: emp, error: fetchError } = await client
      .from('employees')
      .select('password_hash')
      .eq('id', user.id)
      .single();

    if (fetchError || !emp) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    // Verify old password
    const isValid = await verifyPassword(old_password, emp.password_hash);
    if (!isValid) {
      return NextResponse.json({ error: '旧密码不正确' }, { status: 400 });
    }

    // Update password
    const newHash = await hashPassword(new_password);
    const { error: updateError } = await client
      .from('employees')
      .update({ password_hash: newHash, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    if (updateError) throw new Error(`修改失败: ${updateError.message}`);

    return NextResponse.json({ message: '密码修改成功' });
  } catch (err) {
    const message = err instanceof Error ? err.message : '修改密码失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
