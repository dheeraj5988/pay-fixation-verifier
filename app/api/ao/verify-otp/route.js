import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { AccountOfficer } from '@/models';
import { verifyOtp, MAX_ATTEMPTS } from '@/lib/server/otp';
import { signSession, SESSION_COOKIE, sessionCookieOptions } from '@/lib/server/auth';

const GENERIC_FAIL = 'Invalid login ID or password.';

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body.' }, { status: 400 });
  }

  const loginId = String(body.loginId || '').trim().toLowerCase();
  const otp = String(body.otp || '').trim();
  if (!loginId || !otp) {
    return NextResponse.json({ ok: false, error: 'Login ID and OTP are required.' }, { status: 400 });
  }

  try {
    await connectDB();
    const ao = await AccountOfficer.findOne({ loginId });
    if (!ao || !ao.isActive) {
      return NextResponse.json({ ok: false, error: GENERIC_FAIL }, { status: 401 });
    }

    const result = await verifyOtp(ao.otp, otp);

    if (result === 'ok') {
      ao.otp = undefined;
      ao.lastLoginAt = new Date();
      await ao.save();

      const token = signSession({ sub: ao._id.toString(), role: 'ao', loginId: ao.loginId });
      const res = NextResponse.json({ ok: true, message: 'Authenticated.' }, { status: 200 });
      res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
      return res;
    }

    if (result === 'expired' || result === 'none') {
      return NextResponse.json(
        { ok: false, error: 'OTP expired. Please log in again to request a new one.', restart: true },
        { status: 401 }
      );
    }

    if (result === 'locked') {
      ao.otp = undefined;
      await ao.save();
      return NextResponse.json(
        { ok: false, error: 'Too many incorrect attempts. Please log in again.', restart: true },
        { status: 429 }
      );
    }

    const current = ao.otp.toObject ? ao.otp.toObject() : { ...ao.otp };
    current.attempts = (current.attempts ?? 0) + 1;
    const remaining = MAX_ATTEMPTS - current.attempts;

    if (current.attempts >= MAX_ATTEMPTS) {
      ao.otp = undefined;
      await ao.save();
      return NextResponse.json(
        { ok: false, error: 'Too many incorrect attempts. Please log in again.', restart: true },
        { status: 429 }
      );
    }

    ao.otp = current;
    await ao.save();
    return NextResponse.json(
      { ok: false, error: `Incorrect OTP. ${remaining} attempt(s) remaining.` },
      { status: 401 }
    );
  } catch (err) {
    console.error('[ao/verify-otp] error:', err);
    return NextResponse.json({ ok: false, error: 'Verification failed. Please try again.' }, { status: 500 });
  }
}
