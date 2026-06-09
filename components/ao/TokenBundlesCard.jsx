'use client';

import { useEffect, useState } from 'react';
import CheckoutButton from '@/components/CheckoutButton';

function rupees(paise) {
  return '₹' + (Number(paise) / 100).toLocaleString('en-IN');
}

export default function TokenBundlesCard() {
  const [bundles, setBundles] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/token-bundles', { credentials: 'same-origin' });
        const json = await res.json().catch(() => ({}));
        if (!active) return;
        if (json.ok) setBundles(json.bundles || []);
        else setError(json.error || 'Could not load token bundles.');
      } catch {
        if (active) setError('Could not load token bundles.');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-base font-semibold text-slate-900">Buy Token Bundles</h2>
      <p className="mt-1 text-sm text-slate-500">
        Top up processing tokens using your own or departmental funds. Checkout runs through the
        payment gateway in Test Mode.
      </p>

      {error && (
        <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-800 ring-1 ring-red-200">{error}</div>
      )}

      {bundles === null && !error && (
        <p className="mt-4 text-sm text-slate-400">Loading bundles…</p>
      )}

      {bundles && bundles.length === 0 && !error && (
        <p className="mt-4 rounded-md bg-slate-50 px-3 py-4 text-center text-sm text-slate-400">
          No token bundles are currently available.
        </p>
      )}

      {bundles && bundles.length > 0 && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bundles.map((b) => (
            <div key={b.id} className="flex flex-col rounded-xl border border-slate-200 p-4">
              <div className="text-sm font-semibold text-slate-900">{b.name}</div>
              <div className="mt-1 text-2xl font-bold text-indigo-700">
                {b.tokenQuantity}
                <span className="ml-1 text-sm font-normal text-slate-500">tokens</span>
              </div>
              {b.description && <p className="mt-1 flex-1 text-xs text-slate-500">{b.description}</p>}
              <div className="mt-4">
                <CheckoutButton
                  intent="ao_token_bundle"
                  tokenBundleId={b.id}
                  label={`Buy — ${rupees(b.priceInPaise)}`}
                  className="w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-3 text-xs text-slate-400">
        Test Mode — no live charge. After a successful purchase you'll be returned to a status page,
        and your balance updates once payment is confirmed.
      </p>
    </section>
  );
}
