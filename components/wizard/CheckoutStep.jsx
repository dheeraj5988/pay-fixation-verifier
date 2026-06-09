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

export default function CheckoutStep({ result }) {
  const submissionId = result?.id;
  const [ao, setAo] = useState(undefined); // undefined = checking, null = not AO, object = AO
  const [balance, setBalance] = useState(null);
  const [redeeming, setRedeeming] = useState(false);
  const [error, setError] = useState('');
  const [download, setDownload] = useState(null);

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
          setAo(null); // 401 → not signed in as an AO
        }
      } catch {
        if (active) setAo(null);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

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

  const insufficient = balance != null && balance < REDEEM_COST;

  return (
    <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
      <div className="text-center">
        <div className="mb-2 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
          DEMO MODE — Illustrative figures only
        </div>
        <h2 className="mt-4 text-2xl font-bold text-slate-900">Your Pay Fixation Summary</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <TeaserCard label="Starting Salary" value={result?.startingSalary} />
          <TeaserCard label="Current Salary" value={result?.currentSalary} accent />
        </div>
      </div>

      <div className="mt-8 border-t border-slate-200 pt-6">
        <h3 className="text-center text-lg font-semibold text-slate-900">
          Download Detailed Step-by-Step Audit Report
        </h3>

        {download ? (
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

            {error && (
              <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-800 ring-1 ring-red-200">{error}</div>
            )}

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
          <div className="mx-auto mt-4 max-w-md text-center">
            <p className="text-sm text-slate-600">Choose how you&rsquo;d like to get the full report:</p>
            <div className="mt-4 flex flex-col gap-3">
              <a
                href="/ao/login"
                className="rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                I&rsquo;m an Account Officer — Sign in
              </a>
              <p className="text-xs text-slate-400">
                Employee self-service payment is coming soon. Account Officers can sign in to unlock
                with tokens or pay per report.
              </p>
            </div>
            <p className="mt-3 break-all text-xs text-slate-400">Submission reference: {submissionId}</p>
          </div>
        )}
      </div>
    </div>
  );
}
