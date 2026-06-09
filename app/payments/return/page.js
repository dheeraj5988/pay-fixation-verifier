import { Suspense } from 'react';
import ReturnClient from './ReturnClient';
import DemoBanner from '@/components/wizard/DemoBanner';

export const metadata = { title: 'Payment Status — Pay Fixation Verifier' };

export default function PaymentReturnPage() {
  return (
    <main className="min-h-screen">
      <DemoBanner />
      <div className="mx-auto max-w-lg px-4 py-12">
        <Suspense fallback={<p className="text-center text-sm text-slate-500">Loading…</p>}>
          <ReturnClient />
        </Suspense>
      </div>
    </main>
  );
}
