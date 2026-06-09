
export const metadata = { title: 'Checkout (Demo) — Pay Fixation Verifier' };

// Where create-order's STUB payment_url lands when no gateway keys are set.
// This is an honest placeholder — it does NOT charge or credit anything. With
// real Paypur keys configured, create-order returns the real hosted URL and
// this page is never reached.
export default async function StubCheckoutPage({ searchParams }) {
  const sp = (await searchParams) || {};
  const order = typeof sp.order === 'string' ? sp.order : '';
  const continueHref = order ? `/payments/return?order=${encodeURIComponent(order)}` : '/payments/return';

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-lg px-4 py-12">
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-xl font-bold text-slate-900">Demo checkout</h1>
          <p className="mt-2 text-sm text-slate-600">
            No live payment gateway is configured (stub mode). In production, the secure Paypur
            payment page would appear here. No real or simulated charge happens on this screen.
          </p>
          <a
            href={continueHref}
            className="mt-6 inline-block rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Continue to status page
          </a>
          <p className="mt-4 text-xs text-slate-400">
            Order {order || '(none)'} stays &ldquo;created&rdquo; until a gateway callback confirms
            payment.
          </p>
        </div>
      </div>
    </main>
  );
}
