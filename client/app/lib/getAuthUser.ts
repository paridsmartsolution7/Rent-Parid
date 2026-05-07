import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const JWT_SECRET = process.env.JWT_SECRET || '';

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('FATAL: JWT_SECRET is missing or too short. Set a strong secret in .env.local');
}

export async function getAuthUser(request: Request): Promise<{ userId: number; email: string } | null> {
  try {
    const authHeader = request.headers.get('authorization');
    let token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      const cookieStore = await cookies();
      token = cookieStore.get('auth_token')?.value || null;
    }

    if (!token) return null;

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; email: string };
    if (!decoded.userId) return null;

    return { userId: decoded.userId, email: decoded.email };
  } catch {
    return null;
  }
}
