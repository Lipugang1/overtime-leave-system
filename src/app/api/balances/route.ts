import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCurrentUser, isAdmin } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const supabase = getSupabaseClient();

    if (isAdmin(user)) {
      // 超级管理员看全部
      const { data, error } = await supabase
        .from('overtime_balances')
        .select('*, employees!overtime_balances_employee_id_fkey(name, username, position, department, module, squad)')
        .order('remaining_hours', { ascending: false });

      if (error) throw new Error(`查询失败: ${error.message}`);
      return NextResponse.json({ data });
    } else if (user.role_category === 'management') {
      if (user.position === '经理') {
        // 经理可查看部门所有人员的工时汇总
        const { data, error } = await supabase
          .from('overtime_balances')
          .select('*, employees!overtime_balances_employee_id_fkey(name, username, position, department, module, squad)')
          .order('remaining_hours', { ascending: false });
        if (error) throw new Error(`查询失败: ${error.message}`);
        return NextResponse.json({ data });
      } else {
        // 副经理/经理助理看同模块人员的数据
        let employeeIds: string[] = [];
        if (user.module) {
          const { data: mods } = await supabase
            .from('employees')
            .select('id')
            .eq('module', user.module)
            .eq('is_active', true);
          employeeIds = (mods || []).map((e: { id: string }) => e.id);
        }
        if (employeeIds.length > 0) {
          const { data, error } = await supabase
            .from('overtime_balances')
            .select('*, employees!overtime_balances_employee_id_fkey(name, username, position, department, module, squad)')
            .in('employee_id', employeeIds)
            .order('remaining_hours', { ascending: false });
          if (error) throw new Error(`查询失败: ${error.message}`);
          return NextResponse.json({ data });
        }
        // 无模块则只看自己
        const { data, error } = await supabase
          .from('overtime_balances')
          .select('*, employees!overtime_balances_employee_id_fkey(name, username, position, department, module, squad)')
          .eq('employee_id', user.id)
          .maybeSingle();
        if (error) throw new Error(`查询失败: ${error.message}`);
        return NextResponse.json({ data: data ? [data] : [] });
      }
    } else if (user.position === '仓储工班长') {
      // 仓储工班长看同班组人员的数据
      let employeeIds: string[] = [];
      if (user.squad) {
        const { data: sqd } = await supabase
          .from('employees')
          .select('id')
          .eq('squad', user.squad)
          .eq('is_active', true);
        employeeIds = (sqd || []).map((e: { id: string }) => e.id);
      }
      if (employeeIds.length > 0) {
        const { data, error } = await supabase
          .from('overtime_balances')
          .select('*, employees!overtime_balances_employee_id_fkey(name, username, position, department, module, squad)')
          .in('employee_id', employeeIds)
          .order('remaining_hours', { ascending: false });
        if (error) throw new Error(`查询失败: ${error.message}`);
        return NextResponse.json({ data });
      }
      const { data, error } = await supabase
        .from('overtime_balances')
        .select('*, employees!overtime_balances_employee_id_fkey(name, username, position, department, module, squad)')
        .eq('employee_id', user.id)
        .maybeSingle();
      if (error) throw new Error(`查询失败: ${error.message}`);
      return NextResponse.json({ data: data ? [data] : [] });
    } else {
      // 普通用户只看自己
      const { data, error } = await supabase
        .from('overtime_balances')
        .select('*, employees!overtime_balances_employee_id_fkey(name, username, position, department, module, squad)')
        .eq('employee_id', user.id)
        .maybeSingle();
      if (error) throw new Error(`查询失败: ${error.message}`);
      return NextResponse.json({ data: data ? [data] : [] });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : '查询失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
