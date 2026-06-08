import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/server/auth';

export async function requireAO() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = verifySession(token);
  if (!session || session.role !== 'ao') return null;
  return session;
}

export function unauthorized() {
  return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });
}
