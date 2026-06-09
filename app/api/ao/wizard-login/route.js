import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { connectDB } from '@/lib/db';
import { AccountOfficer } from '@/models';
import { verifyPassword, signSession, SESSION_COOKIE, sessionCookieOptions } from '@/lib/server/auth';
import { WIZARD_IDENTITY_COOKIE, verifyWizardIdentity } from '@/lib/server/wizardClaims';

const GENERIC_FAIL = 'Could not sign in. Check your password and try again.';

function normalizePhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d;
}
function phoneVariants(d) {
  return [d, '+91' + d, '91' + d, '0' + d];
}

// POST /api/ao/wizard-login  Body: { password }
// Second factor of the in-wizard AO sign-in. Factor 1 (the phone OTP) is proven
// by the wizard_identity cookie set at /api/wizard/verify-start; factor 2 is the
// password verified here. Only when BOTH hold is an ao_session issued — so this
// is full 2FA, not an OTP-only login.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body.' }, { status: 400 });
  }
  const password = String(body.password || '');
  if (!password) {
    return NextResponse.json({ ok: false, error: 'Password is required.' }, { status: 400 });
  }

  const store = await cookies();
  const idTok = store.get(WIZARD_IDENTITY_COOKIE)?.value;
  const identity = idTok ? verifyWizardIdentity(idTok) : null;
  if (!identity?.phone) {
    return NextResponse.json({ ok: false, error: 'Please verify your mobile number first.', restart: true }, { status: 401 });
  }

  try {
    await connectDB();
    const phone = normalizePhone(identity.phone);
    const ao = await AccountOfficer.findOne({ phone: { $in: phoneVariants(phone) }, isActive: true }).select('+passwordHash');
    if (!ao) return NextResponse.json({ ok: false, error: GENERIC_FAIL }, { status: 401 });

    const okPw = await verifyPassword(password, ao.passwordHash);
    if (!okPw) return NextResponse.json({ ok: false, error: GENERIC_FAIL }, { status: 401 });

    ao.lastLoginAt = new Date();
    await ao.save();

    const token = signSession({ sub: ao._id.toString(), role: 'ao', loginId: ao.loginId });
    const res = NextResponse.json({ ok: true, loginId: ao.loginId }, { status: 200 });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return res;
  } catch (err) {
    console.error('[ao/wizard-login] error:', err);
    return NextResponse.json({ ok: false, error: 'Sign-in failed. Please try again.' }, { status: 500 });
  }
}
