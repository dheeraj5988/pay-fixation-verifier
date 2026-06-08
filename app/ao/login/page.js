import { redirect } from 'next/navigation';
import { requireAO } from '@/lib/server/aoGuard';
import AoLoginForm from '@/components/ao/AoLoginForm';
import DemoBanner from '@/components/wizard/DemoBanner';

export const metadata = { title: 'AO Login — Pay Fixation Verifier' };

// If a valid session cookie is already present, skip the login screen.
export default async function AoLoginPage() {
  const session = await requireAO();
  if (session) redirect('/ao/dashboard');

  return (
    <main className="min-h-screen">
      <DemoBanner />
      <div className="flex min-h-[calc(100vh-2.5rem)] items-center justify-center px-4 py-10">
        <AoLoginForm />
      </div>
    </main>
  );
}
