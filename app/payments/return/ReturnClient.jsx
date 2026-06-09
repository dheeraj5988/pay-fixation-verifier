'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const MAX_ATTEMPTS = 15;
const INTERVAL_MS = 2000;
const REDIRECT_SECONDS = 15;

export default function ReturnClient() {
  const router = useRouter();
  const params = useSearchParams();
  const orderId = params.get('order');
  const [state, setState] = useState('checking'); // checking|verified|failed|timeout|error|unauthorized
  const [data, setData] = useState(null);
  const [redirectIn, setRedirectIn] = useState(null); // null = inactive
  const attempts = useRef(0);

  useEffect(() => {
    if (!orderId) {
      setState('error');
      return;
    }
    let stopped = false;
    let timer;

    async function poll() {
      attempts.current += 1;
      try {
        const res = await fetch(`/api/payments/order-status?order=${encodeURIComponent(orderId)}`, {
          credentials: 'same-origin',
        });
        const json = await res.json().catch(() => ({}));
        if (stopped) return;

        if (res.status === 401 || res.status === 403) {
          setState('unauthorized');
          return;
        }
        if (json.ok && json.status === 'verified') {
          setData(json);
          setState('verified');
          return;
        }
        if (json.ok && json.status === 'failed') {
          setState('failed');
          return;
        }
        if (attempts.current >= MAX_ATTEMPTS) {
          setState('timeout');
          return;
        }
        timer = setTimeout(poll, INTERVAL_MS);
      } catch {
        if (stopped) return;
        if (attempts.current >= MAX_ATTEMPTS) {
          setState('timeout');
          return;
        }
        timer = setTimeout(poll, INTERVAL_MS);
      }
    }

    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [orderId]);

  // Start the auto-redirect countdown once an EMPLOYEE report is confirmed.
  useEffect(() => {
    if (state === 'verified' && data?.orderType === 'employee_report') {
      setRedirectIn(REDIRECT_SECONDS);
    }
  }, [state, data]);

  // Tick the countdown; navigate home at zero.
  useEffect(() => {
    if (redirectIn === null) return;
    if (redirectIn <= 0) {
      router.push('/');
      return;
    }
    const t = setTimeout(() => setRedirectIn((n) => (n === null ? null : n - 1)), 1000);
    return () => clearTimeout(t);
  }, [redirectIn, router]);

  return (
    <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
      {state === 'checking' && (
        <>
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />
          <h1 className="text-xl font-bold text-slate-900">Confirming your payment…</h1>
          <p className="mt-2 text-sm text-slate-500">
            This can take a few seconds while we verify with the payment gateway. Please don't close this page.
          </p>
        </>
      )}

      {state === 'verified' && data?.orderType === 'ao_token_bundle' && (
        <>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700">✓</div>
          <h1 className="text-xl font-bold text-slate-900">Tokens added</h1>
          <p className="mt-2 text-sm text-slate-600">
            {data.creditedTokens} token(s) have been credited to your account.
          </p>
          <a href="/ao/dashboard" className="mt-6 inline-block rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
            Back to dashboard
          </a>
        </>
      )}

      {state === 'verified' && data?.orderType !== 'ao_token_bundle' && (
        <>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700">✓</div>
          <h1 className="text-xl font-bold text-slate-900">Payment confirmed</h1>
          <p className="mt-2 text-sm text-slate-600">Your audit report is ready to download.</p>
          {data?.downloadUrl ? (
            <a href={data.downloadUrl} className="mt-6 inline-block rounded-md bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
              Download report
            </a>
          ) : data?.downloadConsumed ? (
            <p className="mt-6 rounded-md bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-200">
              This report has already been downloaded. Each download link is single-use for security.
            </p>
          ) : (
            <p className="mt-6 text-sm text-slate-500">Preparing your download link…</p>
          )}
          <p className="mt-4 text-xs text-slate-400">The download link is single-use and expires in 7 days.</p>

          {redirectIn !== null && (
            <div className="mt-6 border-t border-slate-100 pt-4">
              <p className="text-sm text-slate-500">
                Returning to the home page in <span className="font-semibold text-slate-700">{redirectIn}s</span> —
                you can re-download anytime from <span className="font-medium">Your Purchased Reports</span>.
              </p>
              <div className="mt-3 flex items-center justify-center gap-4 text-sm">
                <button
                  type="button"
                  onClick={() => setRedirectIn(null)}
                  className="rounded-md border border-slate-300 bg-white px-4 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
                >
                  Stay on this page
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/')}
                  className="font-medium text-indigo-600 hover:text-indigo-700"
                >
                  Go to home now →
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {state === 'failed' && (
        <>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-2xl text-red-600">!</div>
          <h1 className="text-xl font-bold text-slate-900">Payment not completed</h1>
          <p className="mt-2 text-sm text-slate-600">We couldn't confirm a successful payment for this order.</p>
        </>
      )}

      {state === 'timeout' && (
        <>
          <h1 className="text-xl font-bold text-slate-900">Still processing</h1>
          <p className="mt-2 text-sm text-slate-600">
            We haven't received confirmation yet. If you completed payment, it may take a little longer —
            refresh this page in a minute.
          </p>
        </>
      )}

      {state === 'unauthorized' && (
        <>
          <h1 className="text-xl font-bold text-slate-900">Can't show this order</h1>
          <p className="mt-2 text-sm text-slate-600">
            This payment status can only be viewed by the person who started the checkout (or the
            account officer who owns it).
          </p>
        </>
      )}

      {state === 'error' && (
        <>
          <h1 className="text-xl font-bold text-slate-900">Missing order reference</h1>
          <p className="mt-2 text-sm text-slate-600">No order was specified in the link.</p>
        </>
      )}
    </div>
  );
}
