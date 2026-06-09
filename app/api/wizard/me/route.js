import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { WIZARD_IDENTITY_COOKIE, verifyWizardIdentity } from '@/lib/server/wizardClaims';
import { verifySession, SESSION_COOKIE } from '@/lib/server/auth';

// GET /api/wizard/me — current verified identity from the wizard_identity cookie.
// isAccountOfficer reflects a real ao_session (not the claim), so the top bar can
// fully sign an AO out when needed.
export async function GET() {
  const store = await cookies();
  const tok = store.get(WIZARD_IDENTITY_COOKIE)?.value;
  const identity = tok ? verifyWizardIdentity(tok) : null;
  if (!identity?.phone) {
    return NextResponse.json({ ok: true, verified: false });
  }
  const aoTok = store.get(SESSION_COOKIE)?.value;
  const aoSession = aoTok ? verifySession(aoTok) : null;
  const isAccountOfficer = Boolean(aoSession && aoSession.role === 'ao');

  return NextResponse.json({
    ok: true,
    verified: true,
    name: identity.name || '',
    isAccountOfficer,
  });
}
