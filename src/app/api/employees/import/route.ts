import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCurrentUser } from '@/lib/auth';
import { hashPassword } from '@/lib/password';

// 根据 position 自动推断 role_category
function inferRoleCategory(position: string): string {
  if (!position) return 'functional_tech';
  const managementPositions = ['经理', '副经理', '经理助理'];
  const productionPositions = ['仓管员', '仓储工班长'];
  if (managementPositions.includes(position)) return 'management';
  if (productionPositions.includes(position)) return 'production';
  return 'functional_tech';
}

// 生成默认工号：EMP + 序号
async function generateUsername(name: string, client: ReturnType<typeof getSupabaseClient>): Promise<string> {
  const prefix = 'EMP';
  const { data } = await client
    .from('employees')
    .select('username')
    .like('username', `${prefix}%`)
    .order('username', { ascending: false })
    .limit(1);

  let nextNum = 1;
  if (data && data.length > 0) {
    const lastNum = parseInt(data[0].username.replace(prefix, ''), 10);
    if (!isNaN(lastNum)) nextNum = lastNum + 1;
  }
  return `${prefix}${String(nextNum).padStart(3, '0')}`;
}

// 已知的列名关键字（用于判断第一行是否是 header）
const KNOWN_HEADERS = ['username', 'name', 'role_category', 'position', 'department', 'module', 'squad', 'phone', 'password', '工号', '姓名', '角色分类', '岗位', '部门', '模块', '工班', '电话', '密码'];

// 判断第一行是否为 header 行
function isHeaderRow(cols: string[]): boolean {
  const lower = cols.map(c => c.trim().toLowerCase().replace(/^"|"$/g, ''));
  return lower.some(c => KNOWN_HEADERS.includes(c));
}

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
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 1) {
      return NextResponse.json({ error: '文件为空或格式不正确' }, { status: 400 });
    }

    // 判断第一行是否为 header
    const firstLineCols = lines[0].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    const hasHeader = isHeaderRow(firstLineCols);

    // 解析列索引
    let colIndex: Record<string, number>;
    let dataStartLine: number;

    if (hasHeader) {
      const header = firstLineCols.map(c => c.toLowerCase());
      colIndex = {};
      header.forEach((h, i) => { colIndex[h] = i; });
      dataStartLine = 1;
    } else {
      // 无 header 行，使用默认列顺序: username, name, role_category, position, department, module, squad, phone, password
      colIndex = {
        username: 0,
        name: 1,
        role_category: 2,
        position: 3,
        department: 4,
        module: 5,
        squad: 6,
        phone: 7,
        password: 8,
      };
      dataStartLine = 0;
    }

    const getUsername = (cols: string[]) => colIndex['username'] !== undefined && colIndex['username'] < cols.length ? cols[colIndex['username']] : '';
    const getName = (cols: string[]) => colIndex['name'] !== undefined && colIndex['name'] < cols.length ? cols[colIndex['name']] : '';
    const getRoleCategory = (cols: string[]) => colIndex['role_category'] !== undefined && colIndex['role_category'] < cols.length ? cols[colIndex['role_category']] : '';
    const getPosition = (cols: string[]) => colIndex['position'] !== undefined && colIndex['position'] < cols.length ? cols[colIndex['position']] : '';
    const getDepartment = (cols: string[]) => colIndex['department'] !== undefined && colIndex['department'] < cols.length ? cols[colIndex['department']] : '';
    const getModule = (cols: string[]) => colIndex['module'] !== undefined && colIndex['module'] < cols.length ? cols[colIndex['module']] : '';
    const getSquad = (cols: string[]) => colIndex['squad'] !== undefined && colIndex['squad'] < cols.length ? cols[colIndex['squad']] : '';
    const getPhone = (cols: string[]) => colIndex['phone'] !== undefined && colIndex['phone'] < cols.length ? cols[colIndex['phone']] : '';
    const getPassword = (cols: string[]) => colIndex['password'] !== undefined && colIndex['password'] < cols.length ? cols[colIndex['password']] : '';

    const client = getSupabaseClient();
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = dataStartLine; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));

      // 跳过全空行
      if (cols.every(c => !c)) continue;

      const position = getPosition(cols);
      const name = getName(cols);

      if (!name && !position) {
        errors.push(`第${i + 1}行: 姓名和岗位均为空，跳过`);
        continue;
      }

      if (!position) {
        errors.push(`第${i + 1}行: 岗位为空，跳过（${name || '未知'}）`);
        continue;
      }

      // Determine role_category: use CSV value if valid, otherwise infer from position
      let roleCategory = getRoleCategory(cols);
      if (!['admin', 'management', 'functional_tech', 'production'].includes(roleCategory)) {
        roleCategory = inferRoleCategory(position);
      }

      // Determine username: use CSV value if provided, otherwise auto-generate
      let username = getUsername(cols);
      if (!username) {
        username = await generateUsername(name || position, client);
      }

      // Check if username exists
      const { data: existing } = await client
        .from('employees')
        .select('id')
        .eq('username', username)
        .maybeSingle();

      if (existing) {
        skipped++;
        continue;
      }

      const password = getPassword(cols);
      const passwordHash = await hashPassword(password || '123456');

      const { data: emp, error } = await client
        .from('employees')
        .insert({
          username,
          name: name || username,
          role_category: roleCategory,
          position,
          department: getDepartment(cols) || null,
          module: getModule(cols) || null,
          squad: getSquad(cols) || null,
          phone: getPhone(cols) || null,
          password_hash: passwordHash,
        })
        .select('id')
        .single();

      if (error) {
        errors.push(`第${i + 1}行: ${error.message}`);
        continue;
      }

      // Initialize balance
      await client.from('overtime_balances').insert({
        employee_id: emp.id,
        total_overtime_hours: '0',
        used_leave_hours: '0',
        remaining_hours: '0',
      });

      imported++;
    }

    return NextResponse.json({
      message: `导入完成: 成功${imported}条, 跳过${skipped}条${errors.length > 0 ? `, 失败${errors.length}条` : ''}`,
      imported,
      skipped,
      errors: errors.slice(0, 20),
      success: imported,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '导入失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
