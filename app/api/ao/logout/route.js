import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/server/auth';

export async function POST() {
  const res = NextResponse.json({ ok: true, message: 'Signed out.' });
  // Clear the session cookie by overwriting with an immediately-expired value.
  res.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  return res;
}
