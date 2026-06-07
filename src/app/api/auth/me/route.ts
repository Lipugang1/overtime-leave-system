import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth-shared';
export async function GET(request: NextRequest) {
  try {
    // Try Authorization header first (localStorage-based auth)
    const authHeader = request.headers.get('Authorization');
    let token: string | null = null;
    
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else {
      // Fallback to cookie
      token = request.cookies.get('auth_token')?.value || null;
    }

    if (!token) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const user = await verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: '登录已过期' }, { status: 401 });
    }
    return NextResponse.json({ user });
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取用户信息失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
