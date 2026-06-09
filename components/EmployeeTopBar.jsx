'use client';

import { useCallback, useEffect, useState } from 'react';
import { clearIdentity } from '@/lib/wizardStorage';

// Full-width top bar shown when a verified identity is present (cookie-backed).
// Sign Out clears the employee identity (and the AO session, if any), then reloads.
export default function EmployeeTopBar() {
  const [identity, setIdentity] = useState(null);
  const [signingOut, setSigningOut] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/wizard/me', { credentials: 'same-origin' });
      const json = await res.json().catch(() => ({}));
      setIdentity(json.ok && json.verified ? json : null);
    } catch {
      setIdentity(null);
    }
  }, []);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener('pfv-identity-changed', onChange);
    return () => window.removeEventListener('pfv-identity-changed', onChange);
  }, [refresh]);

  async function signOut() {
    setSigningOut(true);
    try {
      await fetch('/api/wizard/logout', { method: 'POST', credentials: 'same-origin' });
      if (identity?.isAccountOfficer) {
        await fetch('/api/ao/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
      }
    } catch {
      /* ignore */
    }
    clearIdentity();
    window.location.assign('/');
  }

  if (!identity) return null;

  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <button
          onClick={signOut}
          disabled={signingOut}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
        >
          {signingOut ? 'Signing out…' : 'Sign Out'}
        </button>
        <span className="text-sm text-slate-600">
          Verified{identity.name ? ` · ${identity.name}` : ''}
          {identity.isAccountOfficer ? ' · Account Officer' : ''}
        </span>
      </div>
    </div>
  );
}
