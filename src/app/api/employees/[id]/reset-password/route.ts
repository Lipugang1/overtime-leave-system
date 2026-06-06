import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { hashPassword } from '@/lib/password';

const DEFAULT_PASSWORD = '123456';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
    if (user.role_category !== 'management' && user.role_category !== 'admin') {
      return NextResponse.json({ error: '无权限操作，仅管理员/管理岗可重置密码' }, { status: 403 });
    }

    const { id } = await params;
    const client = getSupabaseClient();

    // Verify target employee exists
    const { data: emp, error: fetchError } = await client
      .from('employees')
      .select('id, name, username')
      .eq('id', id)
      .maybeSingle();

    if (fetchError || !emp) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    // Reset password to default
    const newHash = await hashPassword(DEFAULT_PASSWORD);
    const { error: updateError } = await client
      .from('employees')
      .update({ password_hash: newHash, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (updateError) throw new Error(`重置失败: ${updateError.message}`);

    return NextResponse.json({
      message: `已将 ${emp.name as string} 的密码重置为 ${DEFAULT_PASSWORD}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '重置密码失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
