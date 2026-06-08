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
      console.error('[ao/login] SMS send failed:', smsErr);
      return NextResponse.json({ ok: false, error: 'Could not send OTP. Please try again shortly.' }, { status: 502 });
    }

    return NextResponse.json(
      { ok: true, stage: 'otp_required', message: 'OTP sent to the registered mobile number.' },
      { status: 200 }
    );
  } catch (err) {
    console.error('[ao/login] error:', err);
    return NextResponse.json({ ok: false, error: 'Login failed. Please try again.' }, { status: 500 });
  }
}
