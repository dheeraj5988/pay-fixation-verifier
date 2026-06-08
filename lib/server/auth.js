import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const BCRYPT_ROUNDS = 12;
const JWT_TTL = '8h';

function getSecret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET is not defined in environment variables');
  return s;
}

export async function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}
export async function verifyPassword(plain, hash) {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}
export function signSession(payload) {
  return jwt.sign(payload, getSecret(), { expiresIn: JWT_TTL });
}
export function verifySession(token) {
  try {
    return jwt.verify(token, getSecret());
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = 'ao_session';

export function sessionCookieOptions(maxAgeSeconds = 8 * 60 * 60) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeSeconds,
  };
}
