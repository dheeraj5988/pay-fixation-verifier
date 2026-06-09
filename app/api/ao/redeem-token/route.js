import { NextResponse } from 'next/server';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import { requireAO, unauthorized } from '@/lib/server/aoGuard';
import { Order, Submission, AccountOfficer, TokenLedger, ProcessingLog } from '@/models';

const DOWNLOAD_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// POST /api/ao/redeem-token   Body: { submissionId }
//
// Lets an authenticated AO unlock a report by spending ONE token instead of
// paying the gateway. One token per (AO, submission) — enforced by the
// ProcessingLog unique index. Re-redeeming an already-unlocked report re-issues
// a fresh download link WITHOUT charging another token.
export async function POST(request) {
  const session = await requireAO();
  if (!session) return unauthorized();

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body.' }, { status: 400 });
  }
  const submissionId = String(body.submissionId || '');
  if (!mongoose.isValidObjectId(submissionId)) {
    return NextResponse.json({ ok: false, error: 'Valid submissionId is required.' }, { status: 400 });
  }

  try {
    await connectDB();
    const submission = await Submission.findById(submissionId).lean();
    if (!submission) return NextResponse.json({ ok: false, error: 'Submission not found.' }, { status: 404 });

    const dbSession = await mongoose.startSession();
    let outcome = { status: 500, body: { ok: false, error: 'Redemption failed.' } };
    try {
      await dbSession.withTransaction(async () => {
        const ao = await AccountOfficer.findById(session.sub).session(dbSession);
        if (!ao || !ao.isActive) {
          outcome = { status: 401, body: { ok: false, error: 'Account not found.' } };
          return;
        }

        const newToken = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + DOWNLOAD_TTL_MS);

        // Already unlocked this report? Re-issue link, no charge.
        const existingLog = await ProcessingLog.findOne({
          accountOfficer: ao._id,
          submission: submissionId,
        }).session(dbSession);

        if (existingLog) {
          let order = existingLog.relatedOrder
            ? await Order.findById(existingLog.relatedOrder).session(dbSession)
            : null;
          if (!order) {
            order = new Order({
              orderType: 'ao_report',
              payer: { kind: 'account_officer', ref: ao._id, refModel: 'AccountOfficer' },
              unlockedSubmission: submissionId,
              amountInPaise: 0,
              isTestMode: true,
              status: 'verified',
            });
          }
          order.downloadToken = newToken;
          order.downloadTokenExpiresAt = expires;
          order.downloadConsumedAt = null;
          await order.save({ session: dbSession });
          outcome = {
            status: 200,
            body: {
              ok: true,
              reused: true,
              message: 'Report already unlocked — fresh download link issued (no token charged).',
              downloadUrl: `/api/reports/download?token=${newToken}`,
              tokenBalance: ao.tokenBalance ?? 0,
            },
          };
          return;
        }

        // First unlock — requires a token.
        if ((ao.tokenBalance ?? 0) < 1) {
          outcome = {
            status: 402,
            body: { ok: false, error: 'Insufficient token balance. Buy tokens or pay per report.', tokenBalance: ao.tokenBalance ?? 0 },
          };
          return;
        }

        const newBalance = (ao.tokenBalance ?? 0) - 1;
        const order = new Order({
          orderType: 'ao_report',
          payer: { kind: 'account_officer', ref: ao._id, refModel: 'AccountOfficer' },
          unlockedSubmission: submissionId,
          amountInPaise: 0,
          isTestMode: true,
          status: 'verified',
          downloadToken: newToken,
          downloadTokenExpiresAt: expires,
        });
        await order.save({ session: dbSession });

        const ledger = await TokenLedger.create(
          [
            {
              accountOfficer: ao._id,
              delta: -1,
              reason: 'redemption',
              relatedSubmission: submissionId,
              relatedOrder: order._id,
              balanceAfter: newBalance,
              createdByKind: 'account_officer',
              createdByRef: ao._id,
              createdByRefModel: 'AccountOfficer',
            },
          ],
          { session: dbSession }
        );

        ao.tokenBalance = newBalance;
        ao.reportsProcessedCount = (ao.reportsProcessedCount ?? 0) + 1;
        await ao.save({ session: dbSession });

        await ProcessingLog.create(
          [
            {
              accountOfficer: ao._id,
              submission: submissionId,
              department: ao.department,
              departmentNameSnapshot: submission.department,
              processingMethod: 'token_redemption',
              relatedOrder: order._id,
              relatedLedgerEntry: ledger[0]._id,
            },
          ],
          { session: dbSession }
        );

        outcome = {
          status: 200,
          body: {
            ok: true,
            message: 'Token redeemed. Report unlocked.',
            downloadUrl: `/api/reports/download?token=${newToken}`,
            tokenBalance: newBalance,
          },
        };
      });
    } catch (txErr) {
      console.error('[redeem-token] tx error:', txErr);
      if (txErr?.code === 11000) {
        outcome = { status: 409, body: { ok: false, error: 'This report was just unlocked. Refresh and use the download link.' } };
      } else {
        outcome = { status: 500, body: { ok: false, error: 'Redemption failed.' } };
      }
    } finally {
      await dbSession.endSession();
    }

    return NextResponse.json(outcome.body, { status: outcome.status });
  } catch (err) {
    console.error('[redeem-token] error:', err);
    return NextResponse.json({ ok: false, error: 'Redemption failed.' }, { status: 500 });
  }
}
