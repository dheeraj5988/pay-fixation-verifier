import SubmissionWizard from '@/components/wizard/SubmissionWizard';
import DemoBanner from '@/components/wizard/DemoBanner';
import EmployeeReportsLibrary from '@/components/EmployeeReportsLibrary';

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <DemoBanner />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Pay Fixation Verifier
          </h1>
          <p className="mt-2 text-sm text-slate-600 sm:text-base">
            Rajasthan State Government — 4CPC → 7CPC pay fixation audit
          </p>
        </header>
        <EmployeeReportsLibrary />
        <SubmissionWizard />
      </div>
    </main>
  );
}
