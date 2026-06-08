'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

function StatCard({ label, value, sub, accent }) {
  return (
    <div className={`rounded-xl p-6 ring-1 ${accent ? 'bg-indigo-50 ring-indigo-200' : 'bg-white ring-slate-200'}`}>
      <div className={`text-sm font-medium ${accent ? 'text-indigo-600' : 'text-slate-500'}`}>{label}</div>
      <div className={`mt-2 text-3xl font-bold ${accent ? 'text-indigo-700' : 'text-slate-900'}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

export default function DashboardShell({ initialLoginId }) {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dbConnected, setDbConnected] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/ao/me', { credentials: 'same-origin' });
        if (res.status === 401) {
          router.push('/ao/login');
          return;
        }
        const json = await res.json().catch(() => ({}));
        if (!active) return;
        if (json.ok) {
          setMe(json.ao || null);
          setDbConnected(json.dbConnected !== false);
        }
      } catch {
        // leave defaults; show graceful fallback
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [router]);

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch('/api/ao/logout', { method: 'POST', credentials: 'same-origin' });
    } catch {
      /* ignore */
    } finally {
      router.push('/ao/login');
    }
  }

  const displayName = me?.name || me?.loginId || initialLoginId || 'Account Officer';
  const balance = dbConnected && me?.tokenBalance != null ? me.tokenBalance : '—';
  const processed = dbConnected && me?.reportsProcessedCount != null ? me.reportsProcessedCount : '—';

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-lg font-bold text-slate-900">AO Dashboard</h1>
            <p className="text-xs text-slate-500">Signed in as {displayName}</p>
          </div>
          <button
            onClick={logout}
            disabled={loggingOut}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            {loggingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {!dbConnected && (
          <div className="mb-6 rounded-md bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-200">
            Live data is unavailable — the database connection is parked for a later sprint.
            Showing session info only; balances will populate once the database is connected.
          </div>
        )}

        <div className="grid gap-5 sm:grid-cols-3">
          <StatCard
            label="Token Balance"
            value={loading ? '…' : balance}
            sub="Available processing tokens"
            accent
          />
          <StatCard
            label="Reports Processed"
            value={loading ? '…' : processed}
            sub="Lifetime count"
          />
          <StatCard
            label="Department"
            value={loading ? '…' : me?.departmentName || '—'}
            sub="Assigned department"
          />
        </div>

        <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-base font-semibold text-slate-900">Process a Report</h2>
          <p className="mt-1 text-sm text-slate-500">
            Redeem a token or pay per report to unlock an employee's detailed step-by-step
            audit report.
          </p>
          <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
            <p className="text-sm text-slate-500">
              Report lookup, token redemption, and the ₹300 per-report payment flow will be
              wired up in the payments phase (Razorpay, Test Mode).
            </p>
            <button
              disabled
              className="mt-4 cursor-not-allowed rounded-md bg-slate-200 px-4 py-2 text-sm font-medium text-slate-400"
            >
              Unlock Report (coming soon)
            </button>
          </div>
        </section>

        <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-base font-semibold text-slate-900">Buy Token Bundles</h2>
          <p className="mt-1 text-sm text-slate-500">
            Top up processing tokens using your own or departmental funds. Bundle options and
            checkout arrive in the payments phase.
          </p>
        </section>
      </main>
    </div>
  );
}
