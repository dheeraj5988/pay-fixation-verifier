import { NextResponse } from 'next/server';
import { WIZARD_IDENTITY_COOKIE } from '@/lib/server/wizardClaims';

// POST /api/wizard/logout — clears the employee identity cookie.
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(WIZARD_IDENTITY_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  return res;
}
