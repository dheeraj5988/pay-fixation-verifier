import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Order } from '@/models';
import { verifyPaypurCallback } from '@/lib/server/paypur';

// POST /api/payments/webhook  (Paypur callback)
//
// Paypur posts: client_order_id, order_id, amount, status, transaction_id,
// date, signature. The signature is MD5 over the concatenated field values +
// secret key (see lib/server/paypur.js).
//
// Defense-in-depth (because plain MD5 is weak on its own):
//   1. Verify the MD5 signature (constant-time compare).
//   2. Require status === 'success'.
//   3. Re-check the callback amount against the stored order's amount.
//   4. Idempotent: an order already 'verified' is acknowledged but not re-processed.
export async function POST(request) {
  // Read the body in a content-type-tolerant way. Paypur's signature is a
  // field concatenation (not a raw-body hash), so we parse fields then verify.
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

  // 1) Signature check.
  let signatureValid = false;
  try {
    signatureValid = verifyPaypurCallback(payload);
  } catch (err) {
    console.error('[webhook] signature compute error:', err?.message || err);
    return NextResponse.json({ ok: false, error: 'Cannot verify signature.' }, { status: 500 });
  }
  if (!signatureValid) {
    console.warn('[webhook] REJECTED: bad signature for client_order_id', clientOrderId);
    return NextResponse.json({ ok: false, error: 'Invalid signature.' }, { status: 401 });
  }

  try {
    await connectDB();
    const order = await Order.findById(String(clientOrderId));
    if (!order) {
      return NextResponse.json({ ok: false, error: 'Order not found.' }, { status: 404 });
    }

    // 4) Idempotency — already finalized, acknowledge and stop.
    if (order.status === 'verified') {
      return NextResponse.json({ ok: true, idempotent: true, message: 'Already processed.' });
    }

    // 2) Status gate.
    if (String(status).toLowerCase() !== 'success') {
      order.status = 'failed';
      order.failureReason = `gateway status: ${status}`;
      await order.save();
      return NextResponse.json({ ok: true, message: 'Recorded non-success status.' });
    }

    // 3) Amount re-check — never trust the callback amount alone.
    const callbackPaise = Math.round(Number(amount) * 100);
    if (!Number.isFinite(callbackPaise) || callbackPaise !== order.amountInPaise) {
      console.warn(
        '[webhook] AMOUNT MISMATCH for', clientOrderId,
        'expected', order.amountInPaise, 'got', callbackPaise
      );
      order.status = 'failed';
      order.failureReason = `amount mismatch: expected ${order.amountInPaise}, got ${callbackPaise}`;
      await order.save();
      return NextResponse.json({ ok: false, error: 'Amount mismatch.' }, { status: 400 });
    }

    // All checks passed → finalize.
    order.status = 'verified';
    order.gatewayTxnId = transactionId || order.gatewayTxnId; // gateway txn id
    order.verifiedAt = new Date();
    await order.save();

    // ------------------------------------------------------------------
    // TODO (next sprint, needs ledger/processing wiring):
    //  - employee_report / ao_report: mint a single-use download token +
    //    advance the Submission.status_flow to 'paid'/'unlocked'.
    //  - ao_report via token: write a negative TokenLedger entry (redemption).
    //  - ao_token_bundle: write a positive TokenLedger entry (purchase) and
    //    update the AO's cached tokenBalance in the same transaction.
    //  - record a ProcessingLog entry where applicable.
    // Deliberately left out here to keep this route scoped to verification +
    // state transition; the post-payment effects touch the append-only ledger
    // and deserve their own reviewed pass.
    // ------------------------------------------------------------------

    return NextResponse.json({ ok: true, message: 'Payment verified.' });
  } catch (err) {
    console.error('[webhook] error:', err);
    return NextResponse.json({ ok: false, error: 'Webhook processing failed.' }, { status: 500 });
  }
}

// Some gateways probe the endpoint with GET — respond politely.
export async function GET() {
  return NextResponse.json({ ok: true, message: 'Paypur webhook endpoint. Use POST.' });
}
