import { NextResponse } from 'next/server';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import { Submission } from '@/models';
import EmployeeOtp from '@/models/EmployeeOtp';

const MAX_ATTEMPTS = 5;

function hashOtp(otp, submissionId) {
  const pepper = process.env.JWT_SECRET || 'pepper';
  return crypto.createHash('sha256').update(`${otp}:${submissionId}:${pepper}`).digest('hex');
}
function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

// POST /api/employee/verify-otp  Body: { submissionId, otp }
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body.' }, { status: 400 });
  }
  const submissionId = String(body.submissionId || '');
  if (!mongoose.isValidObjectId(submissionId)) {
    return NextResponse.json({ ok: false, error: 'A valid submissionId is required.' }, { status: 400 });
  }
  const otp = String(body.otp || '').trim();
  if (!/^[0-9]{6}$/.test(otp)) {
    return NextResponse.json({ ok: false, error: 'Enter the 6-digit code.' }, { status: 400 });
  }

  try {
    await connectDB();
    const challenge = await EmployeeOtp.findOne({ submission: submissionId });
    if (!challenge) {
      return NextResponse.json({ ok: false, error: 'Request an OTP first.', restart: true }, { status: 400 });
    }
    if (new Date(challenge.expiresAt).getTime() < Date.now()) {
      await EmployeeOtp.deleteOne({ _id: challenge._id });
      return NextResponse.json({ ok: false, error: 'Code expired. Request a new one.', restart: true }, { status: 410 });
    }
    if ((challenge.attempts || 0) >= MAX_ATTEMPTS) {
      await EmployeeOtp.deleteOne({ _id: challenge._id });
      return NextResponse.json({ ok: false, error: 'Too many incorrect attempts. Request a new code.', restart: true }, { status: 429 });
    }

    if (!safeEqual(hashOtp(otp, submissionId), challenge.otpHash)) {
      challenge.attempts = (challenge.attempts || 0) + 1;
      await challenge.save();
      const left = Math.max(0, MAX_ATTEMPTS - challenge.attempts);
      return NextResponse.json({ ok: false, error: `Incorrect code. ${left} attempt(s) left.`, attemptsLeft: left }, { status: 401 });
    }

    // Success → mark the submission's phone as verified (the exact fields
    // create-order checks before allowing an employee_report order).
    await Submission.updateOne(
      { _id: submissionId },
      { $set: { 'otpVerification.isVerified': true, 'otpVerification.phone': challenge.phone } }
    );
    await EmployeeOtp.deleteOne({ _id: challenge._id });

    return NextResponse.json({ ok: true, verified: true, phone: challenge.phone });
  } catch (err) {
    console.error('[employee/verify-otp] error:', err);
    return NextResponse.json({ ok: false, error: 'Verification failed. Please try again.' }, { status: 500 });
  }
}
