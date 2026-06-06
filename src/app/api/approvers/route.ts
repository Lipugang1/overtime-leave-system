import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getApprovalRule } from '@/lib/auth-shared';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/**
 * GET /api/approvers?position=xxx&hours=8&is_leave=true
 * 获取指定岗位和调休时长对应的可选审批人列表
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const position = searchParams.get('position') || user.position;
    const hours = parseFloat(searchParams.get('hours') || '0');
    const isLeave = searchParams.get('is_leave') === 'true';

    const rule = getApprovalRule(position, hours, isLeave);

    // 获取所有可选审批人岗位对应的员工
    const allPositions = [...new Set([...rule.level1Approvers, ...rule.level2Approvers, ...rule.level3Approvers])];
    
    if (allPositions.length === 0) {
      return NextResponse.json({ rule, approvers: { level1: [], level2: [], level3: [] } });
    }

    const supabase = getSupabaseClient();
    const { data: employees, error } = await supabase
      .from('employees')
      .select('id, name, position, role_category')
      .in('position', allPositions)
      .eq('is_active', true);

    if (error) {
      return NextResponse.json({ error: '查询审批人失败' }, { status: 500 });
    }

    const approverList = employees || [];

    const filterByPositions = (positions: string[]) =>
      approverList.filter((e: { position: string }) => positions.includes(e.position));

    return NextResponse.json({
      rule: {
        levels: rule.levels,
        level1Approvers: rule.level1Approvers,
        level2Approvers: rule.level2Approvers,
        level3Approvers: rule.level3Approvers,
      },
      approvers: {
        level1: filterByPositions(rule.level1Approvers),
        level2: filterByPositions(rule.level2Approvers),
        level3: filterByPositions(rule.level3Approvers),
      },
    });
  } catch (error) {
    console.error('Get approvers error:', error);
    return NextResponse.json({ error: '获取审批人失败' }, { status: 500 });
  }
}
