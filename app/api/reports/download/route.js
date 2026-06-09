import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Order, Submission } from '@/models';

// GET /api/reports/download?token=<downloadToken>
//
// Single-use, expiring download of the audit report for a paid order.
// The token (minted by the payment webhook) is the bearer credential.
//
// Flow:
//   1. Atomically claim the token: set downloadConsumedAt only if it is still
//      null, the order is 'verified', and the token hasn't expired. This makes
//      the download single-use even under concurrent requests.
//   2. If the claim fails, do a read-only lookup to return a friendly reason.
//   3. Render the report HTML for the order's submission and return it as a
//      file download.
//
// NOTE: the report is built from the CURRENT (stubbed/demo) compute result, so
// it is clearly labelled as illustrative — not a certified pay fixation. When
// the real engine is integrated, this route is unchanged; only the data behind
// computedResult becomes authoritative (and isMock flips to false).

function esc(v) {
  if (v === null || v === undefined) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? '' : dt.toISOString().slice(0, 10);
}

function fmtRs(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '';
  return 'Rs. ' + Number(n).toLocaleString('en-IN');
}

function htmlPage(title, bodyInner) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; color: #1e293b; margin: 0; padding: 32px; }
  .wrap { max-width: 800px; margin: 0 auto; }
  .demo { background:#fef3c7; border:1px solid #fcd34d; color:#92400e; padding:10px 14px; border-radius:8px; font-size:13px; margin-bottom:20px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 15px; margin: 24px 0 8px; color:#334155; border-bottom:1px solid #e2e8f0; padding-bottom:4px; }
  table { width:100%; border-collapse: collapse; font-size: 14px; }
  td { padding: 4px 8px; vertical-align: top; }
  td.k { color:#64748b; width: 220px; }
  .totals { display:flex; gap:16px; margin-top:8px; }
  .card { flex:1; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px; }
  .card .lbl { font-size:12px; color:#64748b; }
  .card .val { font-size:22px; font-weight:bold; margin-top:4px; }
  pre { background:#0f172a; color:#e2e8f0; padding:14px; border-radius:8px; font-size:12px; overflow:auto; white-space:pre-wrap; }
  .foot { margin-top:28px; font-size:11px; color:#94a3b8; }
  @media print { .noprint { display:none; } body { padding: 0; } }
</style></head>
<body><div class="wrap">${bodyInner}</div></body></html>`;
}

function errorPage(status, message) {
  const body = `<div class="demo">DEMO MODE</div>
    <h1>Report unavailable</h1>
    <p>${esc(message)}</p>`;
  return new NextResponse(htmlPage('Report unavailable', body), {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function renderReport(submission, order) {
  const cr = submission.computedResult || {};
  const isMock = cr.isMock !== false; // default treat as mock
  const trace = Array.isArray(cr.traceLines) ? cr.traceLines.join('\n') : '';

  const body = `
    <div class="demo">
      ${isMock ? 'ILLUSTRATIVE / DEMO REPORT — figures are placeholder values from the demo engine and are NOT a certified pay fixation.' : 'Generated report.'}
    </div>
    <h1>Pay Fixation Audit Report</h1>
    <div style="font-size:12px;color:#64748b;">Order ${esc(order._id.toString())} &middot; generated ${esc(fmtDate(new Date()))}</div>

    <h2>Employee Details</h2>
    <table>
      <tr><td class="k">Name</td><td>${esc(submission.name)}</td></tr>
      <tr><td class="k">Designation</td><td>${esc(submission.designation)}</td></tr>
      <tr><td class="k">Department</td><td>${esc(submission.department)}</td></tr>
      <tr><td class="k">Belt / Emp No.</td><td>${esc(submission.beltNo)}</td></tr>
      <tr><td class="k">Date of Birth</td><td>${esc(fmtDate(submission.dob))}</td></tr>
      <tr><td class="k">Date of Joining</td><td>${esc(fmtDate(submission.doj))}</td></tr>
      <tr><td class="k">Date of Retirement</td><td>${esc(fmtDate(submission.dor))}</td></tr>
      <tr><td class="k">Starting CPC</td><td>${esc(submission.startCpc)}th CPC</td></tr>
      <tr><td class="k">Scale / Level</td><td>${esc(submission.scaleOrLevel)}</td></tr>
    </table>

    <h2>Summary</h2>
    <div class="totals">
      <div class="card"><div class="lbl">Starting Salary</div><div class="val">${esc(fmtRs(cr.startingSalary))}</div></div>
      <div class="card"><div class="lbl">Current Salary</div><div class="val">${esc(fmtRs(cr.currentSalary))}</div></div>
    </div>

    <h2>Step-by-step Trace</h2>
    <pre>${esc(trace || 'No trace available.')}</pre>

    <div class="foot">
      Generated by Pay Fixation Verifier. ${isMock ? 'This document contains demonstration figures only and must not be relied upon for any official purpose.' : ''}
    </div>`;
  return htmlPage('Pay Fixation Audit Report', body);
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token = (searchParams.get('token') || '').trim();
  if (!token) return errorPage(400, 'Missing download token.');

  try {
    await connectDB();
    const now = new Date();

    // 1) Atomic single-use claim.
    const order = await Order.findOneAndUpdate(
      {
        downloadToken: token,
        status: 'verified',
        downloadConsumedAt: null,
        downloadTokenExpiresAt: { $gt: now },
      },
      { $set: { downloadConsumedAt: now } },
      { new: true }
    );

    // 2) Claim failed — figure out why (read-only) for a friendly message.
    if (!order) {
      const existing = await Order.findOne({ downloadToken: token }).lean();
      if (!existing) return errorPage(404, 'Invalid download link.');
      if (existing.status !== 'verified') return errorPage(403, 'Payment for this report has not been verified.');
      if (existing.downloadConsumedAt) {
        return errorPage(410, 'This download link has already been used. Each report link is single-use for security.');
      }
      if (existing.downloadTokenExpiresAt && new Date(existing.downloadTokenExpiresAt) <= now) {
        return errorPage(410, 'This download link has expired.');
      }
      return errorPage(403, 'This download link is not available.');
    }

    // 3) Render + return as a file download.
    const submission = await Submission.findById(order.unlockedSubmission).lean();
    if (!submission) return errorPage(404, 'Report data could not be found.');

    const html = renderReport(submission, order);
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
    return errorPage(500, 'Could not generate the report. Please try again.');
  }
}
