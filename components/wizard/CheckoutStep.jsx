'use client';

import { useEffect, useState } from 'react';
import CheckoutButton from '@/components/CheckoutButton';

const REDEEM_COST = 3; // mirrors REDEEM_TOKEN_COST on the server (1 token = Rs.100)

function TeaserCard({ label, value, accent }) {
  return (
    <div className={`rounded-xl p-6 ring-1 ${accent ? 'bg-indigo-50 ring-indigo-200' : 'bg-slate-50 ring-slate-200'}`}>
      <div className={`text-sm font-medium ${accent ? 'text-indigo-600' : 'text-slate-500'}`}>{label}</div>
      <div className={`mt-2 text-3xl font-bold ${accent ? 'text-indigo-700' : 'text-slate-900'}`}>
        {value != null ? '\u20B9' + Number(value).toLocaleString('en-IN') : '\u2014'}
      </div>
    </div>
  );
}

const inputCls =
  'block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500';

// Report checkout. Two entry points:
//   - wizard:     <CheckoutStep result={{ id, startingSalary, currentSalary }} />
//   - standalone: <CheckoutStep submissionId={id} />   (post-login return)
export default function CheckoutStep({ result, submissionId: submissionIdProp }) {
  const submissionId = result?.id || submissionIdProp || '';
  const hasTeaser = result && (result.startingSalary != null || result.currentSalary != null);

  const [ao, setAo] = useState(undefined); // undefined = checking, null = not AO, object = AO
  const [balance, setBalance] = useState(null);
  const [redeeming, setRedeeming] = useState(false);
  const [error, setError] = useState('');
  const [download, setDownload] = useState(null);

  // ---- employee self-pay state ----
  const [empStage, setEmpStage] = useState('phone'); // phone | otp | paying
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [empBusy, setEmpBusy] = useState(false);
  const [empError, setEmpError] = useState('');
  const [empInfo, setEmpInfo] = useState('');
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/ao/me', { credentials: 'same-origin' });
        if (!active) return;
        if (res.ok) {
          const json = await res.json().catch(() => ({}));
          if (json.ok) {
            setAo(json.ao || {});
            setBalance(typeof json.ao?.tokenBalance === 'number' ? json.ao.tokenBalance : null);
          } else {
            setAo(null);
          }
        } else {
          setAo(null);
        }
      } catch {
        if (active) setAo(null);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [cooldownUntil]);
  const cooldownLeft = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));

  // ---- AO redemption ----
  async function redeem() {
    setError('');
    if (!submissionId) {
      setError('Missing submission reference.');
      return;
    }
    setRedeeming(true);
    try {
      const res = await fetch('/api/ao/redeem-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ submissionId }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) {
        setDownload({ downloadUrl: json.downloadUrl, message: json.message, reused: json.reused });
        if (typeof json.tokenBalance === 'number') setBalance(json.tokenBalance);
      } else {
        setError(json.error || 'Could not unlock the report.');
        if (typeof json.tokenBalance === 'number') setBalance(json.tokenBalance);
      }
    } catch {
      setError('Network error \u2014 could not reach the server.');
    } finally {
      setRedeeming(false);
    }
  }

  // ---- employee flow ----
  async function sendOtp(e) {
    if (e) e.preventDefault();
    setEmpError('');
    setEmpInfo('');
    if (!submissionId) {
      setEmpError('Missing submission reference.');
      return;
    }
    setEmpBusy(true);
    try {
      const res = await fetch('/api/employee/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ submissionId, phone }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) {
        setEmpStage('otp');
        setEmpInfo(`A 6-digit code was sent to ${json.maskedPhone || 'your mobile'}.`);
        setCooldownUntil(Date.now() + (json.cooldownSeconds || 30) * 1000);
        setNow(Date.now());
      } else {
        setEmpError(json.error || 'Could not send the code.');
        if (json.cooldownSeconds) {
          setCooldownUntil(Date.now() + json.cooldownSeconds * 1000);
          setNow(Date.now());
        }
      }
    } catch {
      setEmpError('Network error \u2014 could not reach the server.');
    } finally {
      setEmpBusy(false);
    }
  }

  async function verifyOtp(e) {
    if (e) e.preventDefault();
    setEmpError('');
    if (!/^[0-9]{6}$/.test(otp.trim())) {
      setEmpError('Enter the 6-digit code.');
      return;
    }
    setEmpBusy(true);
    try {
      const res = await fetch('/api/employee/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ submissionId, otp: otp.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) {
        setEmpStage('paying');
        startPayment();
        return;
      }
      setEmpError(json.error || 'Verification failed.');
      if (json.restart) {
        setEmpStage('phone');
        setOtp('');
      }
    } catch {
      setEmpError('Network error \u2014 could not reach the server.');
    } finally {
      setEmpBusy(false);
    }
  }

  async function startPayment() {
    setEmpError('');
    setEmpBusy(true);
    try {
      const res = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ intent: 'employee_report', submissionId, mobile: phone }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok && json.payment_url) {
        window.location.href = json.payment_url;
      } else {
        setEmpError(json.error || 'Could not start payment. Please try again.');
        setEmpStage('otp');
      }
    } catch {
      setEmpError('Network error \u2014 could not start payment.');
      setEmpStage('otp');
    } finally {
      setEmpBusy(false);
    }
  }

  const insufficient = balance != null && balance < REDEEM_COST;
  const loginHref = `/ao/login?redirect=${encodeURIComponent('/checkout?submission=' + submissionId)}`;

  return (
    <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
      <div className="text-center">
        <div className="mb-2 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
          DEMO MODE — Illustrative figures only
        </div>
        <h2 className="mt-4 text-2xl font-bold text-slate-900">Your Pay Fixation Summary</h2>
        {hasTeaser ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <TeaserCard label="Starting Salary" value={result?.startingSalary} />
            <TeaserCard label="Current Salary" value={result?.currentSalary} accent />
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            Unlock the detailed step-by-step audit report for this submission below.
          </p>
        )}
      </div>

      <div className="mt-8 border-t border-slate-200 pt-6">
        <h3 className="text-center text-lg font-semibold text-slate-900">
          Download Detailed Step-by-Step Audit Report
        </h3>

        {!submissionId ? (
          <p className="mt-4 text-center text-sm text-red-600">No report was specified.</p>
        ) : download ? (
          <div className="mx-auto mt-4 max-w-md rounded-md bg-emerald-50 p-4 text-center text-sm text-emerald-900 ring-1 ring-emerald-200">
            <p className="font-medium">{download.reused ? 'Report already unlocked' : 'Report unlocked'}</p>
            {download.message && <p className="mt-1">{download.message}</p>}
            {download.downloadUrl && (
              <a
                href={download.downloadUrl}
                className="mt-3 inline-block rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Download report
              </a>
            )}
            <p className="mt-3 text-xs text-emerald-700">Single-use link, expires in 7 days.</p>
          </div>
        ) : ao === undefined ? (
          <p className="mt-4 text-center text-sm text-slate-400">Checking your session\u2026</p>
        ) : ao ? (
          <div className="mx-auto mt-4 max-w-md">
            <div className="rounded-md bg-indigo-50 p-4 text-sm text-indigo-900 ring-1 ring-indigo-200">
              <p>
                Signed in as Account Officer{' '}
                <span className="font-semibold">{ao.loginId || ao.name || 'AO'}</span>.
              </p>
              <p className="mt-1">
                Token balance: <span className="font-semibold">{balance == null ? '\u2014' : balance}</span>
              </p>
            </div>
            {error && <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-800 ring-1 ring-red-200">{error}</div>}
            <div className="mt-4 flex flex-col gap-3">
              <button
                onClick={redeem}
                disabled={redeeming || insufficient}
                className="rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                {redeeming ? 'Redeeming\u2026' : `Redeem ${REDEEM_COST} Tokens`}
              </button>
              {insufficient && (
                <p className="text-center text-xs text-slate-500">
                  You need {REDEEM_COST} tokens (you have {balance}). Buy more on your{' '}
                  <a href="/ao/dashboard" className="text-indigo-600 underline">dashboard</a>.
                </p>
              )}
              <div className="my-1 text-center text-xs text-slate-400">or</div>
              <CheckoutButton
                intent="ao_report"
                submissionId={submissionId}
                label={`Pay \u20B9300 via gateway`}
                className="rounded-md border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
              />
            </div>
          </div>
        ) : (
          // ---- Not an AO: employee self-pay (phone → OTP → Rs.500 gateway) ----
          <div className="mx-auto mt-4 max-w-md">
            <a
              href={loginHref}
              className="block rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-center text-sm font-semibold text-indigo-700 hover:bg-indigo-100"
            >
              Are you an Account Officer? Log in here to use your tokens →
            </a>

            <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />
              <span>or get your report as the employee</span>
              <span className="h-px flex-1 bg-slate-200" />
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <p className="text-sm font-semibold text-slate-900">Employee Report — \u20B9500</p>
              <p className="mt-1 text-xs text-slate-500">
                Verify your mobile number, then pay securely to download your detailed report.
              </p>

              {empError && (
                <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-800 ring-1 ring-red-200">{empError}</div>
              )}
              {empInfo && !empError && (
                <div className="mt-3 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800 ring-1 ring-emerald-200">{empInfo}</div>
              )}

              {empStage === 'phone' && (
                <form onSubmit={sendOtp} className="mt-4 space-y-3">
                  <div className="flex items-stretch">
                    <span className="inline-flex items-center rounded-l-md border border-r-0 border-slate-300 bg-slate-50 px-3 text-sm text-slate-500">+91</span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="10-digit mobile"
                      className={`${inputCls} rounded-l-none`}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={empBusy}
                    className="w-full rounded-md bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {empBusy ? 'Sending\u2026' : 'Send OTP'}
                  </button>
                </form>
              )}

              {empStage === 'otp' && (
                <form onSubmit={verifyOtp} className="mt-4 space-y-3">
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="------"
                    className={`${inputCls} text-center text-lg tracking-[0.5em]`}
                  />
                  <button
                    type="submit"
                    disabled={empBusy}
                    className="w-full rounded-md bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {empBusy ? 'Verifying\u2026' : 'Verify & Continue to Payment'}
                  </button>
                  <div className="flex items-center justify-between text-xs">
                    <button type="button" onClick={() => { setEmpStage('phone'); setOtp(''); setEmpError(''); setEmpInfo(''); }} className="text-slate-500 hover:text-slate-700">
                      ← Change number
                    </button>
                    <button type="button" onClick={sendOtp} disabled={empBusy || cooldownLeft > 0} className="font-medium text-indigo-600 hover:text-indigo-700 disabled:text-slate-300">
                      {cooldownLeft > 0 ? `Resend in ${cooldownLeft}s` : 'Resend OTP'}
                    </button>
                  </div>
                </form>
              )}

              {empStage === 'paying' && (
                <div className="mt-4 text-center">
                  <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-600" />
                  <p className="text-sm text-slate-600">Verified. Redirecting to secure payment\u2026</p>
                  <button type="button" onClick={startPayment} disabled={empBusy} className="mt-3 text-xs font-medium text-indigo-600 hover:text-indigo-700">
                    Not redirected? Continue to payment
                  </button>
                </div>
              )}
            </div>

            <p className="mt-3 break-all text-center text-xs text-slate-400">Submission reference: {submissionId}</p>
          </div>
        )}
      </div>
    </div>
  );
}
