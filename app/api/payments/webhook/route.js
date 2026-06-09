import { NextResponse } from 'next/server';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import { Order, Submission, AccountOfficer, TokenLedger, ProcessingLog } from '@/models';
import { verifyPaypurCallback } from '@/lib/server/paypur';

const DOWNLOAD_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// POST /api/payments/webhook  (Paypur callback)
//
// Paypur posts: client_order_id, order_id, amount, status, transaction_id,
// date, signature. Signature = MD5 over concatenated fields + secret key.
//
// Pipeline:
//   1. Verify MD5 signature (constant-time compare).
//   2. Require status === 'success'.
//   3. Re-check callback amount against the stored order amount.
//   4. Inside a transaction: claim the order (created -> verified) and apply
//      post-payment effects exactly once. The transaction is the idempotency
//      guard — a re-delivered callback finds the order already 'verified' and
//      is acknowledged without re-applying effects.
//
// Post-payment effects by order type:
//   employee_report  -> mint single-use download token; Submission -> 'paid'
//   ao_report        -> download token; Submission -> 'paid'; ProcessingLog
//                       (direct_payment) for the paying AO
//   ao_token_bundle  -> TokenLedger 'purchase' (+qty) + AO.tokenBalance update
export async function POST(request) {
  // ---- Parse body (content-type tolerant) ----
  let payload = {};
  try {
    const ct = request.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      payload = await request.json();
    } else {
      const text = await request.text();
      payload = Object.fromEntries(new URLSearchParams(text));
    }
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid callback body.' }, { status: 400 });
  }

  const {
    client_order_id: clientOrderId,
    amount,
    status,
    transaction_id: transactionId,
    signature,
  } = payload;

  if (!clientOrderId || !signature) {
    return NextResponse.json({ ok: false, error: 'Missing callback fields.' }, { status: 400 });
  }

  // ---- 1) Signature ----
  let signatureValid = false;
  try {
    signatureValid = verifyPaypurCallback(payload);
  } catch (err) {
    console.error('[webhook] signature compute error:', err?.message || err);
    return NextResponse.json({ ok: false, error: 'Cannot verify signature.' }, { status: 500 });
  }
  if (!signatureValid) {
    console.warn('[webhook] REJECTED bad signature for', clientOrderId);
    return NextResponse.json({ ok: false, error: 'Invalid signature.' }, { status: 401 });
  }

  if (!mongoose.isValidObjectId(String(clientOrderId))) {
    return NextResponse.json({ ok: false, error: 'Invalid order reference.' }, { status: 400 });
  }

  try {
    await connectDB();

    // ---- Pre-transaction reads for early, non-mutating rejects ----
    const existing = await Order.findById(String(clientOrderId)).lean();
    if (!existing) {
      return NextResponse.json({ ok: false, error: 'Order not found.' }, { status: 404 });
    }
    if (existing.status === 'verified') {
      return NextResponse.json({ ok: true, idempotent: true, message: 'Already processed.' });
    }

    // ---- 2) Status gate ----
    if (String(status).toLowerCase() !== 'success') {
      await Order.updateOne(
        { _id: existing._id, status: { $ne: 'verified' } },
        { $set: { status: 'failed', failureReason: `gateway status: ${status}` } }
      );
      return NextResponse.json({ ok: true, message: 'Recorded non-success status.' });
    }

    // ---- 3) Amount re-check ----
    const callbackPaise = Math.round(Number(amount) * 100);
    if (!Number.isFinite(callbackPaise) || callbackPaise !== existing.amountInPaise) {
      console.warn('[webhook] AMOUNT MISMATCH', clientOrderId, 'expected', existing.amountInPaise, 'got', callbackPaise);
      await Order.updateOne(
        { _id: existing._id, status: { $ne: 'verified' } },
        { $set: { status: 'failed', failureReason: `amount mismatch: expected ${existing.amountInPaise}, got ${callbackPaise}` } }
      );
      return NextResponse.json({ ok: false, error: 'Amount mismatch.' }, { status: 400 });
    }

    // ---- 4) Transaction: claim + apply effects atomically ----
    const session = await mongoose.startSession();
    let outcome = { status: 500, body: { ok: false, error: 'Webhook processing failed.' } };
    try {
      await session.withTransaction(async () => {
        const order = await Order.findById(existing._id).session(session);
        if (!order) {
          outcome = { status: 404, body: { ok: false, error: 'Order not found.' } };
          return;
        }
        if (order.status === 'verified') {
          // Won the race elsewhere — acknowledge without re-applying effects.
          outcome = { status: 200, body: { ok: true, idempotent: true, message: 'Already processed.' } };
          return;
        }

        order.status = 'verified';
        order.gatewayTxnId = transactionId || order.gatewayTxnId;
        order.verifiedAt = new Date();

        if (order.orderType === 'employee_report' || order.orderType === 'ao_report') {
          // Single-use download grant.
          order.downloadToken = crypto.randomBytes(32).toString('hex');
          order.downloadTokenExpiresAt = new Date(Date.now() + DOWNLOAD_TTL_MS);

          let submissionDeptName;
          if (order.unlockedSubmission) {
            const sub = await Submission.findById(order.unlockedSubmission).session(session);
            if (sub) {
              submissionDeptName = sub.department;
              sub.status_flow = 'paid';
              await sub.save({ session });
            }
          }

          if (order.orderType === 'ao_report' && order.payer?.ref && order.unlockedSubmission) {
            const ao = await AccountOfficer.findById(order.payer.ref).session(session);
            if (ao) {
              // Unique (accountOfficer, submission) — skip if already logged.
              const already = await ProcessingLog.findOne({
                accountOfficer: ao._id,
                submission: order.unlockedSubmission,
              }).session(session);
              if (!already) {
                await ProcessingLog.create(
                  [
                    {
                      accountOfficer: ao._id,
                      submission: order.unlockedSubmission,
                      department: ao.department,
                      departmentNameSnapshot: submissionDeptName,
                      processingMethod: 'direct_payment',
                      relatedOrder: order._id,
                    },
                  ],
                  { session }
                );
                ao.reportsProcessedCount = (ao.reportsProcessedCount ?? 0) + 1;
                await ao.save({ session });
              }
            }
          }

          await order.save({ session });
        } else if (order.orderType === 'ao_token_bundle') {
          if (!order.payer?.ref) throw new Error('token bundle order missing payer');
          // Idempotency: don't double-credit if a purchase entry already exists.
          const dup = await TokenLedger.findOne({
            relatedOrder: order._id,
            reason: 'purchase',
          }).session(session);

          if (!dup) {
            const ao = await AccountOfficer.findById(order.payer.ref).session(session);
            if (!ao) throw new Error('AO not found for token-bundle credit');
            const qty = order.tokenQuantity || 0;
            if (qty <= 0) throw new Error('token bundle order has no tokenQuantity');
            const newBalance = (ao.tokenBalance ?? 0) + qty;

            await TokenLedger.create(
              [
                {
                  accountOfficer: ao._id,
                  delta: qty,
                  reason: 'purchase',
                  relatedOrder: order._id,
                  balanceAfter: newBalance,
                  createdByKind: 'system',
                },
              ],
              { session }
            );
            ao.tokenBalance = newBalance;
            await ao.save({ session });
          }

          await order.save({ session });
        } else {
          await order.save({ session });
        }

        outcome = { status: 200, body: { ok: true, message: 'Payment verified.' } };
      });
    } catch (txErr) {
      console.error('[webhook] transaction error:', txErr);
      outcome = { status: 500, body: { ok: false, error: 'Webhook processing failed.' } };
    } finally {
      await session.endSession();
    }

    return NextResponse.json(outcome.body, { status: outcome.status });
  } catch (err) {
    console.error('[webhook] error:', err);
    return NextResponse.json({ ok: false, error: 'Webhook processing failed.' }, { status: 500 });
  }
}

// Some gateways probe with GET.
export async function GET() {
  return NextResponse.json({ ok: true, message: 'Paypur webhook endpoint. Use POST.' });
}
