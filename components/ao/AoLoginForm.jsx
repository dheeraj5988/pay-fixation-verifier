'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const inputCls =
  'block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500';

// Only allow internal, single-leading-slash paths (blocks open-redirects like
// //evil.com, http://evil.com, /\evil). Falls back to the dashboard otherwise.
function safeInternal(path) {
  return typeof path === 'string' && /^\/[^/\\]/.test(path) ? path : '';
}

export default function AoLoginForm({ redirect }) {
  const router = useRouter();
  const dest = safeInternal(redirect) || '/ao/dashboard';

  const [stage, setStage] = useState('credentials');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [cooldownUntil]);

  const cooldownLeft = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));

  async function sendOtp(e) {
    if (e) e.preventDefault();
    setError('');
    setInfo('');
    if (!loginId.trim() || !password) {
      setError('Enter your login ID and password.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/ao/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ loginId: loginId.trim(), password }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok && json.stage === 'otp_required') {
        setStage('otp');
        setInfo('A 6-digit code was sent to the registered mobile number.');
        setCooldownUntil(Date.now() + 30000);
        setNow(Date.now());
      } else {
        setError(json.error || 'Login failed. Please try again.');
      }
    } catch {
      setError('Network error — could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

  async function verify(e) {
    if (e) e.preventDefault();
    setError('');
    if (!/^[0-9]{6}$/.test(otp.trim())) {
      setError('Enter the 6-digit code.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/ao/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ loginId: loginId.trim(), otp: otp.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) {
        router.push(dest); // back to where they came from (sanitized), else dashboard
        return;
      }
      setError(json.error || 'Verification failed.');
      if (json.restart) {
        setStage('credentials');
        setOtp('');
      }
    } catch {
      setError('Network error — could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

  function backToCredentials() {
    setStage('credentials');
    setOtp('');
    setError('');
    setInfo('');
  }

  return (
    <div className="w-full max-w-md">
      <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-slate-900">Account Officer Portal</h1>
          <p className="mt-1 text-sm text-slate-500">
            {stage === 'credentials' ? 'Sign in with your official credentials.' : 'Two-factor verification.'}
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-800 ring-1 ring-red-200">{error}</div>
        )}
        {info && !error && (
          <div className="mb-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800 ring-1 ring-emerald-200">{info}</div>
        )}

        {stage === 'credentials' ? (
          <form onSubmit={sendOtp} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Login ID</label>
              <input type="text" autoComplete="username" value={loginId} onChange={(e) => setLoginId(e.target.value)} className={`mt-1 ${inputCls}`} placeholder="e.g. ao_test" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Password</label>
              <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={`mt-1 ${inputCls}`} placeholder="••••••••" />
            </div>
            <button type="submit" disabled={busy} className="w-full rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60">
              {busy ? 'Sending OTP…' : 'Send OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={verify} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">6-digit OTP</label>
              <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))} className={`mt-1 tracking-[0.5em] text-center text-lg ${inputCls}`} placeholder="------" />
              <p className="mt-1 text-xs text-slate-400">
                Sent to the mobile number registered for <span className="font-medium">{loginId}</span>.
              </p>
            </div>
            <button type="submit" disabled={busy} className="w-full rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60">
              {busy ? 'Verifying…' : 'Verify & Sign In'}
            </button>
            <div className="flex items-center justify-between text-sm">
              <button type="button" onClick={backToCredentials} className="text-slate-500 hover:text-slate-700">← Back</button>
              <button type="button" onClick={sendOtp} disabled={busy || cooldownLeft > 0} className="font-medium text-indigo-600 hover:text-indigo-700 disabled:text-slate-300">
                {cooldownLeft > 0 ? `Resend in ${cooldownLeft}s` : 'Resend OTP'}
              </button>
            </div>
          </form>
        )}
      </div>
      <p className="mt-4 text-center text-xs text-slate-400">Authorized government use only. Access is logged.</p>
    </div>
  );
}
