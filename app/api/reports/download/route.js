import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Order, Submission } from '@/models';
import { renderReportHtml, reportErrorHtml } from '@/lib/server/renderReport';

function errPage(status, message) {
  return new NextResponse(reportErrorHtml(message), {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

// GET /api/reports/download?token=<downloadToken> — single-use, expiring.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token = (searchParams.get('token') || '').trim();
  if (!token) return errPage(400, 'Missing download token.');

  try {
    await connectDB();
    const now = new Date();
    const order = await Order.findOneAndUpdate(
      { downloadToken: token, status: 'verified', downloadConsumedAt: null, downloadTokenExpiresAt: { $gt: now } },
      { $set: { downloadConsumedAt: now } },
      { new: true }
    );

    if (!order) {
      const existing = await Order.findOne({ downloadToken: token }).lean();
      if (!existing) return errPage(404, 'Invalid download link.');
      if (existing.status !== 'verified') return errPage(403, 'Payment for this report has not been verified.');
      if (existing.downloadConsumedAt) {
        return errPage(410, 'This download link has already been used. Each report link is single-use for security.');
      }
      if (existing.downloadTokenExpiresAt && new Date(existing.downloadTokenExpiresAt) <= now) {
        return errPage(410, 'This download link has expired.');
      }
      return errPage(403, 'This download link is not available.');
    }

    const submission = await Submission.findById(order.unlockedSubmission).lean();
    if (!submission) return errPage(404, 'Report data could not be found.');

    const html = renderReportHtml(submission, { reference: order._id.toString() });
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="pay-fixation-audit-${order._id.toString()}.html"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('[reports/download] error:', err);
    return errPage(500, 'Could not generate the report. Please try again.');
  }
}
