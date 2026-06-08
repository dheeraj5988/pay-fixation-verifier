import { redirect } from 'next/navigation';
import { requireAO } from '@/lib/server/aoGuard';
import DashboardShell from '@/components/ao/DashboardShell';

export const metadata = { title: 'AO Dashboard — Pay Fixation Verifier' };

// Server-side cookie gate: no valid AO session → bounce to login.
export default async function AoDashboardPage() {
  const session = await requireAO();
  if (!session) redirect('/ao/login');

  return <DashboardShell initialLoginId={session.loginId} />;
}
