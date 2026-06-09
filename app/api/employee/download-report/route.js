import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import { Submission, Order } from '@/models';
import { WIZARD_IDENTITY_COOKIE, verifyWizardIdentity } from '@/lib/server/wizardClaims';
import { renderReportHtml, reportErrorHtml } from '@/lib/server/renderReport';

function errPage(status, message) {
  return new NextResponse(reportErrorHtml(message), {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
function normalizePhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d;
}

// GET /api/employee/download-report?submissionId=<id>
// Persistent, re-downloadable. Ownership = the wizard_identity cookie's phone
// matches this submission's verified phone AND the employee paid (a verified
// employee_report order exists). No token consumed.
export async function GET(request) {
  const store = await cookies();
  const idTok = store.get(WIZARD_IDENTITY_COOKIE)?.value;
  const identity = idTok ? verifyWizardIdentity(idTok) : null;
  if (!identity?.phone) return errPage(401, 'Please verify your mobile number to access your reports.');

  const { searchParams } = new URL(request.url);
  const submissionId = (searchParams.get('submissionId') || '').trim();
  if (!mongoose.isValidObjectId(submissionId)) return errPage(400, 'A valid submissionId is required.');

  try {
    await connectDB();
    const sub = await Submission.findById(submissionId).lean();
    if (!sub) return errPage(404, 'Report data could not be found.');

    const cookiePhone = normalizePhone(identity.phone);
    const subPhone = normalizePhone(sub.otpVerification?.phone || '');
    const phoneOk = Boolean(sub.otpVerification?.isVerified) && subPhone && subPhone === cookiePhone;
    if (!phoneOk) return errPage(403, 'This report is not associated with your verified mobile number.');

    const paid = await Order.findOne({
      orderType: 'employee_report',
      status: 'verified',
      unlockedSubmission: submissionId,
    })
      .select('_id')
      .lean();
    if (!paid) return errPage(403, 'This report has not been paid for yet.');

    const html = renderReportHtml(sub, { reference: submissionId });
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="pay-fixation-audit-${submissionId}.html"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('[employee/download-report] error:', err);
    return errPage(500, 'Could not generate the report.');
  }
}
