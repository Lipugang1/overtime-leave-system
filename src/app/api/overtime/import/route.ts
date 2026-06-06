import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCurrentUser } from '@/lib/auth';
import { hashPassword } from '@/lib/password';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
    if (user.role_category !== 'management' && user.role_category !== 'admin') {
      return NextResponse.json({ error: '无权限操作' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ error: '请上传文件' }, { status: 400 });
    }

    const text = await file.text();
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) {
      return NextResponse.json({ error: '文件为空或格式不正确' }, { status: 400 });
    }

    const client = getSupabaseClient();
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Skip header line
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      if (cols.length < 3) {
        errors.push(`第${i + 1}行: 字段不足`);
        continue;
      }

      const [username, overtime_date, hours, description] = cols;

      // Find employee by username
      const { data: employee } = await client
        .from('employees')
        .select('id')
        .eq('username', username)
        .maybeSingle();

      if (!employee) {
        errors.push(`第${i + 1}行: 用户 ${username} 不存在`);
        skipped++;
        continue;
      }

      // Insert as approved overtime (imported data is pre-approved)
      const { error } = await client
        .from('overtime_records')
        .insert({
          employee_id: employee.id,
          overtime_date,
          hours: hours.toString(),
          description: description || '历史数据导入',
          status: 'approved',
          imported: true,
        });

      if (error) {
        errors.push(`第${i + 1}行: ${error.message}`);
        continue;
      }

      // Update balance
      const { data: balance } = await client
        .from('overtime_balances')
        .select('*')
        .eq('employee_id', employee.id)
        .maybeSingle();

      if (balance) {
        const totalOvertime = parseFloat(balance.total_overtime_hours) + parseFloat(hours);
        const remaining = totalOvertime - parseFloat(balance.used_leave_hours);
        await client
          .from('overtime_balances')
          .update({
            total_overtime_hours: totalOvertime.toFixed(2),
            remaining_hours: remaining.toFixed(2),
            updated_at: new Date().toISOString(),
          })
          .eq('employee_id', employee.id);
      } else {
        await client.from('overtime_balances').insert({
          employee_id: employee.id,
          total_overtime_hours: parseFloat(hours).toFixed(2),
          used_leave_hours: '0.00',
          remaining_hours: parseFloat(hours).toFixed(2),
        });
      }

      imported++;
    }

    return NextResponse.json({
      message: `导入完成: 成功${imported}条, 跳过${skipped}条`,
      imported,
      skipped,
      errors: errors.slice(0, 10),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '导入失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
