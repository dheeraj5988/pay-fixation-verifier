import jwt from 'jsonwebtoken';

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET is not defined in environment variables');
  return s;
}

// "Just submitted" teaser claim — lets ONLY the submitter see the salary teaser
// on /checkout?submission=<id>. Set by /api/submissions, read by the checkout page.
export const TEASER_COOKIE = 'teaser_claim';
export function signTeaserClaim(submissionId) {
  return jwt.sign({ submissionId: String(submissionId), typ: 'teaser' }, secret(), { expiresIn: '2h' });
}
export function verifyTeaserClaim(token) {
  try {
    const d = jwt.verify(token, secret());
    return d?.typ === 'teaser' ? d : null;
  } catch {
    return null;
  }
}

// Wizard identity — proves this browser OTP-verified ownership of a phone at
// Step 0. EMPLOYEE-GRADE ONLY: it carries a verified phone forward so the
// submission can be marked phone-verified. It does NOT grant Account Officer
// access (AO sign-in still requires the password as a second factor).
export const WIZARD_IDENTITY_COOKIE = 'wizard_identity';
export function signWizardIdentity({ phone, name }) {
  return jwt.sign({ phone: String(phone), name: String(name || ''), typ: 'wizard_id' }, secret(), { expiresIn: '2h' });
}
export function verifyWizardIdentity(token) {
  try {
    const d = jwt.verify(token, secret());
    return d?.typ === 'wizard_id' ? d : null;
  } catch {
    return null;
  }
}

export function shortCookieOptions(maxAgeSeconds = 2 * 60 * 60) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeSeconds,
  };
}
