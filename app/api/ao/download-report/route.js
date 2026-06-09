import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import { requireAO } from '@/lib/server/aoGuard';
import { Submission, ProcessingLog } from '@/models';
import { renderReportHtml, reportErrorHtml } from '@/lib/server/renderReport';

function errPage(status, message) {
  return new NextResponse(reportErrorHtml(message), {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

// GET /api/ao/download-report?submissionId=<id>
// Persistent, re-downloadable. Authenticated by the AO session and gated by
// ownership: the AO must have a ProcessingLog for this submission (created when
// they unlocked it, by tokens or by gateway payment). No token is consumed.
export async function GET(request) {
  const session = await requireAO();
  if (!session) return errPage(401, 'Please sign in as an Account Officer to download this report.');

  const { searchParams } = new URL(request.url);
  const submissionId = (searchParams.get('submissionId') || '').trim();
  if (!mongoose.isValidObjectId(submissionId)) return errPage(400, 'A valid submissionId is required.');

  try {
    await connectDB();
    const owns = await ProcessingLog.findOne({
      accountOfficer: session.sub,
      submission: submissionId,
    }).lean();
    if (!owns) return errPage(403, 'You have not unlocked this report. Unlock it first to download.');

    const submission = await Submission.findById(submissionId).lean();
    if (!submission) return errPage(404, 'Report data could not be found.');

    const html = renderReportHtml(submission, { reference: submissionId });
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="pay-fixation-audit-${submissionId}.html"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('[ao/download-report] error:', err);
    return errPage(500, 'Could not generate the report.');
  }
}
