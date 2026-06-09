import { redirect as nextRedirect } from 'next/navigation';
import { requireAO } from '@/lib/server/aoGuard';
import AoLoginForm from '@/components/ao/AoLoginForm';

export const metadata = { title: 'AO Login — Pay Fixation Verifier' };

function safeInternal(path) {
  return typeof path === 'string' && /^\/[^/\\]/.test(path) ? path : '';
}

export default async function AoLoginPage({ searchParams }) {
  const sp = (await searchParams) || {};
  const redirectParam = typeof sp.redirect === 'string' ? sp.redirect : '';
  const dest = safeInternal(redirectParam);

  // Already signed in? Honor the redirect target (or dashboard).
  const session = await requireAO();
  if (session) nextRedirect(dest || '/ao/dashboard');

  return (
    <main className="min-h-screen">
      <div className="flex min-h-[calc(100vh-2.5rem)] items-center justify-center px-4 py-10">
        <AoLoginForm redirect={dest} />
      </div>
    </main>
  );
}
