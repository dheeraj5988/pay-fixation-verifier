import CheckoutStep from '@/components/wizard/CheckoutStep';
import DemoBanner from '@/components/wizard/DemoBanner';

export const metadata = { title: 'Unlock Report — Pay Fixation Verifier' };

// Reachable at /checkout?submission=<id>. Used as the post-login return target
// so an AO who logged in from the wizard lands straight back on this report's
// unlock screen. No teaser figures here (kept off a by-id URL); just the unlock
// options for the given submission.
export default async function CheckoutPage({ searchParams }) {
  const sp = (await searchParams) || {};
  const submissionId = typeof sp.submission === 'string' ? sp.submission : '';

  return (
    <main className="min-h-screen">
      <DemoBanner />
      <div className="mx-auto max-w-3xl px-4 py-10">
        <CheckoutStep submissionId={submissionId} />
      </div>
    </main>
  );
}
