import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { connectDB } from '@/lib/db';
import WizardStartOtp from '@/models/WizardStartOtp';
import { sendOtpSms } from '@/lib/server/sms';

const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 30 * 1000;

function normalizePhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d;
}
function validPhone(d) {
  return /^[6-9][0-9]{9}$/.test(d);
}
function genOtp() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}
function hashOtp(otp, phone) {
  const pepper = process.env.JWT_SECRET || 'pepper';
  return crypto.createHash('sha256').update(`${otp}:${phone}:${pepper}`).digest('hex');
}

// POST /api/wizard/start-otp  Body: { name, phone }
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body.' }, { status: 400 });
  }
  const name = String(body.name || '').trim();
  if (name.length < 2) {
    return NextResponse.json({ ok: false, error: 'Please enter your name.' }, { status: 400 });
  }
  const phone = normalizePhone(body.phone);
  if (!validPhone(phone)) {
    return NextResponse.json({ ok: false, error: 'Enter a valid 10-digit Indian mobile number.' }, { status: 400 });
  }

  try {
    await connectDB();
    const now = Date.now();
    const existing = await WizardStartOtp.findOne({ phone });
    if (existing?.lastSentAt && now - new Date(existing.lastSentAt).getTime() < RESEND_COOLDOWN_MS) {
      const wait = Math.ceil((RESEND_COOLDOWN_MS - (now - new Date(existing.lastSentAt).getTime())) / 1000);
      return NextResponse.json(
        { ok: false, error: `Please wait ${wait}s before requesting another code.`, cooldownSeconds: wait },
        { status: 429 }
      );
    }

    const otp = genOtp();
    await WizardStartOtp.findOneAndUpdate(
      { phone },
      {
        $set: { name, otpHash: hashOtp(otp, phone), expiresAt: new Date(now + OTP_TTL_MS), attempts: 0, lastSentAt: new Date(now) },
        $inc: { sendCount: 1 },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await sendOtpSms(phone, otp);

    return NextResponse.json({
      ok: true,
      sent: true,
      maskedPhone: `xxxxxx${phone.slice(-4)}`,
      cooldownSeconds: RESEND_COOLDOWN_MS / 1000,
      ttlSeconds: OTP_TTL_MS / 1000,
    });
  } catch (err) {
    console.error('[wizard/start-otp] error:', err);
    return NextResponse.json({ ok: false, error: 'Could not send the code. Please try again.' }, { status: 500 });
  }
}
