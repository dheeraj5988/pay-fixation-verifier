import jwt from 'jsonwebtoken';

// Short-lived signed claim that binds an employee (no login) download to the
// browser that started checkout. Issued by create-order, verified by
// order-status. AO orders don't need this — they're bound by the AO session.

const CLAIM_TTL = '2h';
export const DL_CLAIM_COOKIE = 'dl_claim';

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET is not defined in environment variables');
  return s;
}

export function signDownloadClaim(orderId) {
  return jwt.sign({ orderId: String(orderId), typ: 'dl_claim' }, secret(), { expiresIn: CLAIM_TTL });
}

export function verifyDownloadClaim(token) {
  try {
    const decoded = jwt.verify(token, secret());
    return decoded?.typ === 'dl_claim' ? decoded : null;
  } catch {
    return null;
  }
}

export function claimCookieOptions(maxAgeSeconds = 2 * 60 * 60) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeSeconds,
  };
}
