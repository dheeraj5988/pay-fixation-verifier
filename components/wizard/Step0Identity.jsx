'use client';

import { useEffect, useState } from 'react';

const inputCls =
  'block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500';

// Mandatory Step 0: verify a mobile number before the calculator unlocks.
// If the number is an AO, a password step-up issues their session (full 2FA);
// otherwise the verified phone is carried forward (employee-grade).
export default function Step0Identity({ initialName = '', onVerified }) {
  const [stage, setStage] = useState('phone'); // phone | otp | ao_password
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
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
    if (name.trim().length < 2) {
      setError('Please enter your name.');
      return;
    }
    if (!/^[6-9][0-9]{9}$/.test(phone)) {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/wizard/start-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ name: name.trim(), phone }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) {
        setStage('otp');
        setInfo(`A 6-digit code was sent to ${json.maskedPhone || 'your mobile'}.`);
        setCooldownUntil(Date.now() + (json.cooldownSeconds || 30) * 1000);
        setNow(Date.now());
      } else {
        setError(json.error || 'Could not send the code.');
        if (json.cooldownSeconds) {
          setCooldownUntil(Date.now() + json.cooldownSeconds * 1000);
          setNow(Date.now());
        }
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
      const res = await fetch('/api/wizard/verify-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ phone, otp: otp.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) {
        const verifiedName = json.name || name.trim();
        setName(verifiedName);
        if (json.isAccountOfficer) {
          setInfo('');
          setStage('ao_password');
        } else {
          onVerified({ name: verifiedName, phone, isAccountOfficer: false, aoLoggedIn: false });
        }
        return;
      }
      setError(json.error || 'Verification failed.');
      if (json.restart) {
        setStage('phone');
        setOtp('');
      }
    } catch {
      setError('Network error — could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

  async function aoSignIn(e) {
    if (e) e.preventDefault();
    setError('');
    if (!password) {
      setError('Enter your password.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/ao/wizard-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ password }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) {
        onVerified({ name, phone, isAccountOfficer: true, aoLoggedIn: true, loginId: json.loginId });
        return;
      }
      setError(json.error || 'Sign-in failed.');
      if (json.restart) {
        setStage('phone');
        setOtp('');
        setPassword('');
      }
    } catch {
      setError('Network error — could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

  function continueAsApplicant() {
    // AO number, but they choose not to sign in — proceed as a verified applicant.
    onVerified({ name, phone, isAccountOfficer: true, aoLoggedIn: false });
  }

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
      <div className="mx-auto max-w-md">
        <h2 className="text-center text-xl font-bold text-slate-900">Verify your mobile to begin</h2>
        <p className="mt-1 text-center text-sm text-slate-500">
          A quick one-time verification keeps the service secure. It takes a few seconds.
        </p>

        {error && <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-800 ring-1 ring-red-200">{error}</div>}
        {info && !error && <div className="mt-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800 ring-1 ring-emerald-200">{info}</div>}

        {stage === 'phone' && (
          <form onSubmit={sendOtp} className="mt-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={`mt-1 ${inputCls}`} placeholder="Full name" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Mobile Number</label>
              <div className="mt-1 flex items-stretch">
                <span className="inline-flex items-center rounded-l-md border border-r-0 border-slate-300 bg-slate-50 px-3 text-sm text-slate-500">+91</span>
                <input type="tel" inputMode="numeric" maxLength={10} value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))} className={`${inputCls} rounded-l-none`} placeholder="10-digit mobile" />
              </div>
            </div>
            <button type="submit" disabled={busy} className="w-full rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60">
              {busy ? 'Sending OTP…' : 'Send OTP'}
            </button>
          </form>
        )}

        {stage === 'otp' && (
          <form onSubmit={verify} className="mt-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">6-digit OTP</label>
              <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))} className={`mt-1 text-center text-lg tracking-[0.5em] ${inputCls}`} placeholder="------" />
            </div>
            <button type="submit" disabled={busy} className="w-full rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60">
              {busy ? 'Verifying…' : 'Verify & Continue'}
            </button>
            <div className="flex items-center justify-between text-xs">
              <button type="button" onClick={() => { setStage('phone'); setOtp(''); setError(''); setInfo(''); }} className="text-slate-500 hover:text-slate-700">← Change number</button>
              <button type="button" onClick={sendOtp} disabled={busy || cooldownLeft > 0} className="font-medium text-indigo-600 hover:text-indigo-700 disabled:text-slate-300">
                {cooldownLeft > 0 ? `Resend in ${cooldownLeft}s` : 'Resend OTP'}
              </button>
            </div>
          </form>
        )}

        {stage === 'ao_password' && (
          <form onSubmit={aoSignIn} className="mt-5 space-y-4">
            <div className="rounded-md bg-indigo-50 p-3 text-sm text-indigo-900 ring-1 ring-indigo-200">
              This number is registered to an Account Officer. Enter your password to sign in and use your tokens.
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Password</label>
              <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={`mt-1 ${inputCls}`} placeholder="••••••••" />
            </div>
            <button type="submit" disabled={busy} className="w-full rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60">
              {busy ? 'Signing in…' : 'Sign in as Account Officer'}
            </button>
            <button type="button" onClick={continueAsApplicant} className="w-full text-center text-xs font-medium text-slate-500 hover:text-slate-700">
              Not now — continue as a regular applicant
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
