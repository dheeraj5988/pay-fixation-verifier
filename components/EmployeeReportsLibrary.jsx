'use client';

import { useEffect, useState } from 'react';

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return Number.isNaN(dt.getTime())
    ? '—'
    : dt.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Shown on the home page only when the visitor's verified phone (wizard_identity
// cookie) has paid-for reports. Renders nothing otherwise.
export default function EmployeeReportsLibrary() {
  const [reports, setReports] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/employee/my-reports', { credentials: 'same-origin' });
        const json = await res.json().catch(() => ({}));
        if (!active) return;
        setReports(json.ok && Array.isArray(json.reports) ? json.reports : []);
      } catch {
        if (active) setReports([]);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (!reports || reports.length === 0) return null;

  return (
    <section className="mb-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-base font-semibold text-slate-900">Your Purchased Reports</h2>
      <p className="mt-1 text-sm text-slate-500">
        Reports you&rsquo;ve paid for. Download any of them again at no extra charge.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
              <th className="px-2 py-2 font-medium">Employee</th>
              <th className="px-2 py-2 font-medium">Department</th>
              <th className="px-2 py-2 font-medium">Date of Birth</th>
              <th className="px-2 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.submissionId} className="border-b border-slate-100 last:border-0">
                <td className="px-2 py-3 font-medium text-slate-800">{r.name || '—'}</td>
                <td className="px-2 py-3 text-slate-600">{r.department || '—'}</td>
                <td className="px-2 py-3 text-slate-600">{fmtDate(r.dob)}</td>
                <td className="px-2 py-3 text-right">
                  <a
                    href={`/api/employee/download-report?submissionId=${encodeURIComponent(r.submissionId)}`}
                    className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                  >
                    Download
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
