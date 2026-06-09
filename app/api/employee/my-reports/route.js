import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { connectDB } from '@/lib/db';
import { Submission, Order } from '@/models';
import { WIZARD_IDENTITY_COOKIE, verifyWizardIdentity } from '@/lib/server/wizardClaims';

function normalizePhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d;
}
function phoneVariants(d) {
  return [d, '+91' + d, '91' + d, '0' + d];
}

// GET /api/employee/my-reports
// Reports this verified phone has PAID for (a verified employee_report order
// exists). Returns an empty list (not 401) when there's no identity cookie, so
// the home-page library can simply render nothing.
export async function GET() {
  const store = await cookies();
  const idTok = store.get(WIZARD_IDENTITY_COOKIE)?.value;
  const identity = idTok ? verifyWizardIdentity(idTok) : null;
  if (!identity?.phone) return NextResponse.json({ ok: true, reports: [] });

  try {
    await connectDB();
    const phone = normalizePhone(identity.phone);
    const subs = await Submission.find({
      'otpVerification.phone': { $in: phoneVariants(phone) },
      'otpVerification.isVerified': true,
    })
      .select('name department dob otpVerification')
      .lean();
    if (!subs.length) return NextResponse.json({ ok: true, reports: [] });

    const ids = subs.map((s) => s._id);
    const paidOrders = await Order.find({
      orderType: 'employee_report',
      status: 'verified',
      unlockedSubmission: { $in: ids },
    })
      .select('unlockedSubmission')
      .lean();
    const paidSet = new Set(paidOrders.map((o) => String(o.unlockedSubmission)));

    const reports = subs
      .filter((s) => paidSet.has(String(s._id)))
      .map((s) => ({
        submissionId: s._id.toString(),
        name: s.name || null,
        department: s.department || null,
        dob: s.dob || null,
      }));

    return NextResponse.json({ ok: true, reports });
  } catch (err) {
    console.error('[employee/my-reports] error:', err);
    return NextResponse.json({ ok: false, error: 'Could not load your reports.' }, { status: 500 });
  }
}
