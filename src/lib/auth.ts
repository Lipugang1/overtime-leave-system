import { cookies, headers } from 'next/headers';
import { verifyToken, type AuthUser } from './auth-shared';

// Re-export everything from auth-shared
export * from './auth-shared';

export async function getCurrentUser(): Promise<AuthUser | null> {
  // Try Authorization header first (localStorage-based auth)
  try {
    const headersList = await headers();
    const authHeader = headersList.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      return verifyToken(token);
    }
  } catch {
    // headers() might fail in some contexts
  }

  // Fallback to cookie
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return null;
    return verifyToken(token);
  } catch {
    return null;
  }
}
