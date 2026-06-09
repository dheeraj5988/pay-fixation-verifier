'use client';

import { useEffect, useState } from 'react';

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

function methodLabel(m) {
  if (m === 'token_redemption') return 'Tokens';
  if (m === 'direct_payment') return 'Paid';
  return m || '—';
}

export default function UnlockedReportsList() {
  const [reports, setReports] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/ao/my-reports', { credentials: 'same-origin' });
        const json = await res.json().catch(() => ({}));
        if (!active) return;
        if (json.ok) setReports(json.reports || []);
        else setError(json.error || 'Could not load your reports.');
      } catch {
        if (active) setError('Could not load your reports.');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-base font-semibold text-slate-900">My Unlocked Reports</h2>
      <p className="mt-1 text-sm text-slate-500">
        Reports you&rsquo;ve unlocked. Download any of them again at no further charge.
      </p>

      {error && (
        <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-800 ring-1 ring-red-200">{error}</div>
      )}

      {reports === null && !error && (
        <p className="mt-4 text-sm text-slate-400">Loading your reports…</p>
      )}

      {reports && reports.length === 0 && !error && (
        <div className="mt-4 rounded-md bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
          You haven&rsquo;t unlocked any reports yet. Unlock one from the wizard checkout to see it here.
        </div>
      )}

      {reports && reports.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                <th className="px-2 py-2 font-medium">Employee</th>
                <th className="px-2 py-2 font-medium">Designation</th>
                <th className="px-2 py-2 font-medium">Department</th>
                <th className="px-2 py-2 font-medium">Unlocked</th>
                <th className="px-2 py-2 font-medium">Via</th>
                <th className="px-2 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.submissionId} className="border-b border-slate-100 last:border-0">
                  <td className="px-2 py-3 font-medium text-slate-800">{r.employeeName || '—'}</td>
                  <td className="px-2 py-3 text-slate-600">{r.designation || '—'}</td>
                  <td className="px-2 py-3 text-slate-600">{r.department || '—'}</td>
                  <td className="px-2 py-3 text-slate-600">{fmtDate(r.processedAt)}</td>
                  <td className="px-2 py-3">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      {methodLabel(r.method)}
                    </span>
                  </td>
                  <td className="px-2 py-3 text-right">
                    <a
                      href={`/api/ao/download-report?submissionId=${encodeURIComponent(r.submissionId)}`}
                      className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                    >
                      Download
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
