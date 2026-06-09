import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { connectDB } from '@/lib/db';
import { AccountOfficer } from '@/models';
import WizardStartOtp from '@/models/WizardStartOtp';
import { signWizardIdentity, WIZARD_IDENTITY_COOKIE, shortCookieOptions } from '@/lib/server/wizardClaims';

const MAX_ATTEMPTS = 5;

function normalizePhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d;
}
function hashOtp(otp, phone) {
  const pepper = process.env.JWT_SECRET || 'pepper';
  return crypto.createHash('sha256').update(`${otp}:${phone}:${pepper}`).digest('hex');
}
function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}
function phoneVariants(d) {
  return [d, '+91' + d, '91' + d, '0' + d];
}

// POST /api/wizard/verify-start  Body: { phone, otp }
// Verifies the Step 0 OTP, sets the (employee-grade) wizard_identity cookie, and
// reports whether the phone belongs to an active AO. Does NOT log an AO in —
// that still requires the password (see /api/ao/wizard-login).
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body.' }, { status: 400 });
  }
  const phone = normalizePhone(body.phone);
  if (!/^[6-9][0-9]{9}$/.test(phone)) {
    return NextResponse.json({ ok: false, error: 'A valid mobile number is required.' }, { status: 400 });
  }
  const otp = String(body.otp || '').trim();
  if (!/^[0-9]{6}$/.test(otp)) {
    return NextResponse.json({ ok: false, error: 'Enter the 6-digit code.' }, { status: 400 });
  }

  try {
    await connectDB();
    const challenge = await WizardStartOtp.findOne({ phone });
    if (!challenge) {
      return NextResponse.json({ ok: false, error: 'Request an OTP first.', restart: true }, { status: 400 });
    }
    if (new Date(challenge.expiresAt).getTime() < Date.now()) {
      await WizardStartOtp.deleteOne({ _id: challenge._id });
      return NextResponse.json({ ok: false, error: 'Code expired. Request a new one.', restart: true }, { status: 410 });
    }
    if ((challenge.attempts || 0) >= MAX_ATTEMPTS) {
      await WizardStartOtp.deleteOne({ _id: challenge._id });
      return NextResponse.json({ ok: false, error: 'Too many incorrect attempts. Request a new code.', restart: true }, { status: 429 });
    }

    if (!safeEqual(hashOtp(otp, phone), challenge.otpHash)) {
      challenge.attempts = (challenge.attempts || 0) + 1;
      await challenge.save();
      const left = Math.max(0, MAX_ATTEMPTS - challenge.attempts);
      return NextResponse.json({ ok: false, error: `Incorrect code. ${left} attempt(s) left.`, attemptsLeft: left }, { status: 401 });
    }

    const name = challenge.name || '';
    await WizardStartOtp.deleteOne({ _id: challenge._id });

    // Read-only AO detection (no session issued here).
    const ao = await AccountOfficer.findOne({ phone: { $in: phoneVariants(phone) }, isActive: true })
      .select('_id')
      .lean();
    const isAccountOfficer = Boolean(ao);

    const res = NextResponse.json({ ok: true, verified: true, isAccountOfficer, name });
    res.cookies.set(WIZARD_IDENTITY_COOKIE, signWizardIdentity({ phone, name }), shortCookieOptions());
    return res;
  } catch (err) {
    console.error('[wizard/verify-start] error:', err);
    return NextResponse.json({ ok: false, error: 'Verification failed. Please try again.' }, { status: 500 });
  }
}
