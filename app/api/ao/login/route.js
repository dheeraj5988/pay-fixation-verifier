import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { AccountOfficer } from '@/models';
import { verifyPassword } from '@/lib/server/auth';
import { generateOtpCode, buildOtpSubdoc, checkCooldown } from '@/lib/server/otp';
import { sendOtpSms } from '@/lib/server/sms';

const GENERIC_FAIL = 'Invalid login ID or password.';

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body.' }, { status: 400 });
  }

  const loginId = String(body.loginId || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!loginId || !password) {
    return NextResponse.json({ ok: false, error: GENERIC_FAIL }, { status: 401 });
  }

  try {
    await connectDB();
  } catch (dbErr) {
    console.error('[ao/login] ❌ DATABASE unreachable at connect — check your Atlas IP allowlist & MONGODB_URI:', dbErr?.message || dbErr);
    return NextResponse.json({ ok: false, error: 'Service temporarily unavailable. Please try again.' }, { status: 503 });
  }

  try {
    const ao = await AccountOfficer.findOne({ loginId }).select('+passwordHash');
    const passwordOk = ao && ao.isActive && (await verifyPassword(password, ao.passwordHash));
    if (!passwordOk) {
      return NextResponse.json({ ok: false, error: GENERIC_FAIL }, { status: 401 });
    }

    const cooldown = checkCooldown(ao.otp);
    if (!cooldown.ok) {
      return NextResponse.json(
        { ok: false, error: `Please wait ${Math.ceil(cooldown.waitMs / 1000)}s before requesting another OTP.` },
        { status: 429 }
      );
    }

    const code = generateOtpCode();
    ao.otp = await buildOtpSubdoc(code);
    await ao.save();

    try {
      await sendOtpSms(ao.phone, code);
    } catch (smsErr) {
      console.error('[ao/login] ❌ SMS send failed — see the [sms] Fast2SMS payload logged above.');
      return NextResponse.json({ ok: false, error: 'Could not send OTP. Please try again shortly.' }, { status: 502 });
    }

    return NextResponse.json(
      { ok: true, stage: 'otp_required', message: 'OTP sent to the registered mobile number.' },
      { status: 200 }
    );
  } catch (err) {
    if (String(err?.name || '').startsWith('Mongo')) {
      console.error('[ao/login] ❌ DATABASE error during query — check Atlas allowlist & MONGODB_URI:', err?.message || err);
      return NextResponse.json({ ok: false, error: 'Service temporarily unavailable. Please try again.' }, { status: 503 });
    }
    console.error('[ao/login] ❌ Unexpected error:', err);
    return NextResponse.json({ ok: false, error: 'Login failed. Please try again.' }, { status: 500 });
  }
}
