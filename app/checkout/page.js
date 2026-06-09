import { cookies } from 'next/headers';
import mongoose from 'mongoose';
import CheckoutStep from '@/components/wizard/CheckoutStep';
import { connectDB } from '@/lib/db';
import { Submission } from '@/models';
import { TEASER_COOKIE, verifyTeaserClaim } from '@/lib/server/wizardClaims';

export const metadata = { title: 'Unlock Report — Pay Fixation Verifier' };

// /checkout?submission=<id>
// Shows the salary teaser ONLY to the submitter (valid teaser cookie for this
// id). Also reads otpVerification so a pre-verified employee skips the OTP step.
export default async function CheckoutPage({ searchParams }) {
  const sp = (await searchParams) || {};
  const submissionId = typeof sp.submission === 'string' ? sp.submission : '';

  let teaser = null;
  let phoneVerified = false;

  if (submissionId && mongoose.isValidObjectId(submissionId)) {
    try {
      await connectDB();
      const sub = await Submission.findById(submissionId).select('computedResult otpVerification').lean();
      if (sub) {
        phoneVerified = Boolean(sub.otpVerification?.isVerified);
        const store = await cookies();
        const tok = store.get(TEASER_COOKIE)?.value;
        const claim = tok ? verifyTeaserClaim(tok) : null;
        if (claim && String(claim.submissionId) === String(submissionId) && sub.computedResult) {
          teaser = {
            id: submissionId,
            startingSalary: sub.computedResult.startingSalary,
            currentSalary: sub.computedResult.currentSalary,
          };
        }
      }
    } catch (err) {
      console.error('[checkout page] error:', err);
    }
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <CheckoutStep submissionId={submissionId} result={teaser} phoneVerified={phoneVerified} />
      </div>
    </main>
  );
}
