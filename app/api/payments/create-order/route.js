import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Order, Submission, TokenBundle } from '@/models';
import {
  createPaypurOrder,
  priceForIntent,
} from '@/lib/server/paypur';

// POST /api/payments/create-order
// Body: { intent: 'employee_report' | 'ao_report' | 'ao_token_bundle',
//         submissionId?, tokenBundleId?, name?, email?, mobile? }
//
// The client sends ONLY intent + references. The SERVER computes the amount.
// Any client-sent `amount` is ignored entirely.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body.' }, { status: 400 });
  }

  const intent = String(body.intent || '');
  const validIntents = ['employee_report', 'ao_report', 'ao_token_bundle'];
  if (!validIntents.includes(intent)) {
    return NextResponse.json({ ok: false, error: 'Unknown payment intent.' }, { status: 400 });
  }

  try {
    await connectDB();

    // ---- Resolve a SERVER-AUTHORITATIVE amount + build the Order doc ----
    let amountInRupees = null;
    const orderDoc = { orderType: intent, currency: 'INR', isTestMode: true };

    if (intent === 'employee_report' || intent === 'ao_report') {
      amountInRupees = priceForIntent(intent);
      if (amountInRupees == null) {
        return NextResponse.json({ ok: false, error: 'No price configured for intent.' }, { status: 400 });
      }

      // A report order must point at a real submission.
      const submissionId = String(body.submissionId || '');
      if (!submissionId) {
        return NextResponse.json({ ok: false, error: 'submissionId is required for report orders.' }, { status: 400 });
      }
      const submission = await Submission.findById(submissionId).lean();
      if (!submission) {
        return NextResponse.json({ ok: false, error: 'Submission not found.' }, { status: 404 });
      }
      orderDoc.unlockedSubmission = submissionId;

      if (intent === 'employee_report') {
        // Employee path: payer is the submission, OTP-verified phone required.
        const verifiedPhone =
          submission?.otpVerification?.isVerified ? submission.otpVerification.phone : null;
        if (!verifiedPhone) {
          return NextResponse.json(
            { ok: false, error: 'Phone must be OTP-verified before payment.' },
            { status: 403 }
          );
        }
        orderDoc.payer = {
          kind: 'submission',
          ref: submissionId,
          refModel: 'Submission',
          verifiedPhone,
        };
      } else {
        // AO path: payer is the account officer (auth wiring added when DB sprint lands).
        const aoId = String(body.accountOfficerId || '');
        if (!aoId) {
          return NextResponse.json({ ok: false, error: 'accountOfficerId is required for AO report orders.' }, { status: 400 });
        }
        orderDoc.payer = { kind: 'account_officer', ref: aoId, refModel: 'AccountOfficer' };
      }
    } else {
      // Token bundle: amount comes from the TokenBundle record, never the client.
      const bundleId = String(body.tokenBundleId || '');
      if (!bundleId) {
        return NextResponse.json({ ok: false, error: 'tokenBundleId is required.' }, { status: 400 });
      }
      const bundle = await TokenBundle.findById(bundleId).lean();
      if (!bundle || bundle.isActive === false) {
        return NextResponse.json({ ok: false, error: 'Token bundle not found or inactive.' }, { status: 404 });
      }
      amountInRupees = bundle.priceInPaise / 100;
      const aoId = String(body.accountOfficerId || '');
      if (!aoId) {
        return NextResponse.json({ ok: false, error: 'accountOfficerId is required for token purchases.' }, { status: 400 });
      }
      orderDoc.payer = { kind: 'account_officer', ref: aoId, refModel: 'AccountOfficer' };
      orderDoc.tokenBundle = bundleId;
      orderDoc.tokenQuantity = bundle.tokenQuantity;
    }

    orderDoc.amountInPaise = Math.round(amountInRupees * 100);

    // Persist the Order as 'created' BEFORE talking to Paypur, so we always
    // have our own client_order_id to reconcile the callback against.
    const order = await new Order(orderDoc).save();

    // ---- Ask Paypur for a payment URL ----
    const redirectUrl =
      (process.env.APP_BASE_URL || '') + `/payments/return?order=${order._id.toString()}`;

    const result = await createPaypurOrder({
      amountInRupees,
      clientOrderId: order._id.toString(),
      redirectUrl,
      name: body.name,
      email: body.email,
      mobile: body.mobile,
    });

    if (!result.ok) {
      order.status = 'failed';
      order.failureReason = result.error || 'create order failed';
      await order.save();
      return NextResponse.json({ ok: false, error: result.error || 'Could not create payment.' }, { status: 502 });
    }

    // Record Paypur's order id for later reconciliation.
    if (result.order_id) {
      order.razorpayOrderId = result.order_id; // reusing existing field as the gateway order id
      await order.save();
    }

    return NextResponse.json({
      ok: true,
      stub: Boolean(result.stub),
      orderId: order._id.toString(),
      amountInPaise: order.amountInPaise,
      payment_url: result.payment_url,
    });
  } catch (err) {
    console.error('[create-order] error:', err);
    return NextResponse.json({ ok: false, error: 'Could not create order. Please try again.' }, { status: 500 });
  }
}
