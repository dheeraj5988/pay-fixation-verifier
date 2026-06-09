'use client';

import { useState } from 'react';

// Posts the payment INTENT (never an amount) to /api/payments/create-order,
// then redirects the browser to Paypur's hosted payment_url.
//
// Props:
//   intent           - 'employee_report' | 'ao_report' | 'ao_token_bundle'
//   submissionId     - required for report intents
//   tokenBundleId    - required for token bundle intent
//   accountOfficerId - required for AO intents
//   payer            - optional { name, email, mobile } passed to the gateway
//   label            - button text
//   className        - optional style override
export default function CheckoutButton({
  intent,
  submissionId,
  tokenBundleId,
  accountOfficerId,
  payer = {},
  label = 'Pay now',
  className,
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function startCheckout() {
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          intent,
          submissionId,
          tokenBundleId,
          accountOfficerId,
          name: payer.name,
          email: payer.email,
          mobile: payer.mobile,
        }),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.ok || !json.payment_url) {
        setError(json.error || 'Could not start payment. Please try again.');
        setBusy(false);
        return;
      }

      // Hand off to the gateway's hosted checkout.
      window.location.href = json.payment_url;
    } catch {
      setError('Network error — could not start payment.');
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={startCheckout}
        disabled={busy}
        className={
          className ||
          'rounded-md bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60'
        }
      >
        {busy ? 'Redirecting to payment…' : label}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
