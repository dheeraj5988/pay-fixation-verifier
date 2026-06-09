'use client';

import { useState } from 'react';

// Lets an authenticated AO spend 3 tokens to unlock a report by submission ID.
export default function UnlockReportCard({ onRedeemed }) {
  const [submissionId, setSubmissionId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  async function redeem(e) {
    if (e) e.preventDefault();
    setError('');
    setResult(null);
    const id = submissionId.trim();
    if (!id) {
      setError('Enter a submission ID.');
      return;
    }
    if (!/^[a-fA-F0-9]{24}$/.test(id)) {
      setError('That doesn\u2019t look like a valid submission ID (expected a 24-character ID).');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/ao/redeem-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ submissionId: id }),
      });
      const json = await res.json().catch(() => ({}));

      if (res.ok && json.ok) {
        setResult(json);
        if (onRedeemed) onRedeemed(json);
      } else {
        setError(json.error || 'Could not unlock the report.');
        if (typeof json.tokenBalance === 'number' && onRedeemed) {
          onRedeemed({ ...json, balanceOnly: true });
        }
      }
    } catch {
      setError('Network error \u2014 could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-base font-semibold text-slate-900">Unlock a Report</h2>
      <p className="mt-1 text-sm text-slate-500">
        Spend 3 tokens to unlock an employee&rsquo;s detailed audit report. Re-unlocking a report
        you&rsquo;ve already opened issues a fresh link without charging again.
      </p>

      <form onSubmit={redeem} className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={submissionId}
          onChange={(e) => setSubmissionId(e.target.value)}
          placeholder="Submission ID (24-character)"
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
        >
          {busy ? 'Unlocking\u2026' : 'Redeem 3 Tokens'}
        </button>
      </form>

      <p className="mt-2 text-xs text-slate-400">
        The submission ID is the record&rsquo;s database ID, created when an employee submits the
        public form.
      </p>

      {error && (
        <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-800 ring-1 ring-red-200">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-4 rounded-md bg-emerald-50 p-4 text-sm text-emerald-900 ring-1 ring-emerald-200">
          <p className="font-medium">
            {result.reused ? 'Report already unlocked' : 'Tokens redeemed \u2014 report unlocked'}
          </p>
          <p className="mt-1 text-emerald-800">{result.message}</p>
          {result.downloadUrl && (
            <a
              href={result.downloadUrl}
              className="mt-3 inline-block rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Download report
            </a>
          )}
          <p className="mt-3 text-xs text-emerald-700">
            This download link is single-use and expires in 7 days.
          </p>
        </div>
      )}
    </section>
  );
}
