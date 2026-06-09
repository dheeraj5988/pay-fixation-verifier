import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { requireAO, unauthorized } from '@/lib/server/aoGuard';
import { ProcessingLog } from '@/models';

// GET /api/ao/my-reports — submissions this AO has unlocked (owns).
export async function GET() {
  const session = await requireAO();
  if (!session) return unauthorized();

  try {
    await connectDB();
    const logs = await ProcessingLog.find({ accountOfficer: session.sub })
      .sort({ processedAt: -1 })
      .populate('submission', 'name designation department')
      .lean();

    const reports = logs
      .map((l) => {
        const sub = l.submission && typeof l.submission === 'object' ? l.submission : null;
        return {
          submissionId: sub?._id ? sub._id.toString() : null,
          employeeName: sub?.name || null,
          designation: sub?.designation || null,
          department: sub?.department || l.departmentNameSnapshot || null,
          method: l.processingMethod,
          processedAt: l.processedAt,
        };
      })
      .filter((r) => r.submissionId);

    return NextResponse.json({ ok: true, reports });
  } catch (err) {
    console.error('[ao/my-reports] error:', err);
    return NextResponse.json({ ok: false, error: 'Could not load your reports.' }, { status: 500 });
  }
}
