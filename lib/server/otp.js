import bcrypt from 'bcryptjs';

const OTP_TTL_MS = 5 * 60 * 1000;
const COOLDOWN_MS = 30 * 1000;
const MAX_ATTEMPTS = 5;
const OTP_BCRYPT_ROUNDS = 8;

export function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}
export async function hashOtp(code) {
  return bcrypt.hash(code, OTP_BCRYPT_ROUNDS);
}
export function checkCooldown(otpSubdoc) {
  if (!otpSubdoc?.lastSentAt) return { ok: true, waitMs: 0 };
  const elapsed = Date.now() - new Date(otpSubdoc.lastSentAt).getTime();
  if (elapsed >= COOLDOWN_MS) return { ok: true, waitMs: 0 };
  return { ok: false, waitMs: COOLDOWN_MS - elapsed };
}
export async function buildOtpSubdoc(code) {
  return {
    codeHash: await hashOtp(code),
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
    attempts: 0,
    lastSentAt: new Date(),
  };
}
export async function verifyOtp(otpSubdoc, submittedCode) {
  if (!otpSubdoc?.codeHash || !otpSubdoc?.expiresAt) return 'none';
  if (Date.now() > new Date(otpSubdoc.expiresAt).getTime()) return 'expired';
  if ((otpSubdoc.attempts ?? 0) >= MAX_ATTEMPTS) return 'locked';
  const match = await bcrypt.compare(String(submittedCode), otpSubdoc.codeHash);
  return match ? 'ok' : 'mismatch';
}

export { MAX_ATTEMPTS, OTP_TTL_MS, COOLDOWN_MS };
