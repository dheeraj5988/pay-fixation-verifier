import { NextResponse } from 'next/server';
import { requireAO, unauthorized } from '@/lib/server/aoGuard';

export async function GET() {
  const session = await requireAO();
  if (!session) return unauthorized();

  // Base response from the (DB-free) session token.
  const base = {
    ok: true,
    ao: { loginId: session.loginId },
    dbConnected: false,
  };

  // Try to enrich with live data. If the DB is parked/unreachable, degrade
  // gracefully rather than 500 — the dashboard shell still renders.
  try {
    const { connectDB } = await import('@/lib/db');
    const { AccountOfficer, Department } = await import('@/models');
    await connectDB();

    const ao = await AccountOfficer.findById(session.sub).lean();
    if (ao) {
      let departmentName = null;
      if (ao.department) {
        const dept = await Department.findById(ao.department).lean();
        departmentName = dept?.name || null;
      }
      return NextResponse.json({
        ok: true,
        dbConnected: true,
        ao: {
          loginId: ao.loginId,
          name: ao.name,
          tokenBalance: ao.tokenBalance ?? 0,
          reportsProcessedCount: ao.reportsProcessedCount ?? 0,
          departmentName,
        },
      });
    }
    // Authenticated cookie but no matching record — still return base.
    return NextResponse.json(base);
  } catch (err) {
    console.error('[ao/me] DB enrich skipped:', err?.message || err);
    return NextResponse.json(base);
  }
}
