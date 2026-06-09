import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import { Order } from '@/models';
import { requireAO } from '@/lib/server/aoGuard';
import { verifyDownloadClaim, DL_CLAIM_COOKIE } from '@/lib/server/downloadClaim';

// GET /api/payments/order-status?order=<id>
//
// Returns an order's status, and — only to a bound caller — the single-use
// download link once the order is verified. Binding:
//   - AO orders (ao_report, ao_token_bundle): require AO session that OWNS the order
//   - employee orders: require the signed dl_claim cookie matching this order
// This is what stops a random caller who guesses an order id from getting the link.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const orderId = (searchParams.get('order') || '').trim();
  if (!mongoose.isValidObjectId(orderId)) {
    return NextResponse.json({ ok: false, error: 'Valid order id required.' }, { status: 400 });
  }

  try {
    await connectDB();
    const order = await Order.findById(orderId).select('+downloadToken');
    if (!order) return NextResponse.json({ ok: false, error: 'Order not found.' }, { status: 404 });

    // ---- Binding ----
    if (order.payer?.kind === 'account_officer') {
      const session = await requireAO();
      if (!session) return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });
      if (String(order.payer.ref) !== String(session.sub)) {
        return NextResponse.json({ ok: false, error: 'Not authorized for this order.' }, { status: 403 });
      }
    } else {
      const store = await cookies();
      const claimTok = store.get(DL_CLAIM_COOKIE)?.value;
      const claim = claimTok ? verifyDownloadClaim(claimTok) : null;
      if (!claim || String(claim.orderId) !== String(order._id)) {
        return NextResponse.json({ ok: false, error: 'Not authorized for this order.' }, { status: 403 });
      }
    }

    // ---- Status payload ----
    const base = { ok: true, status: order.status, orderType: order.orderType };
    if (order.status !== 'verified') {
      return NextResponse.json(base); // caller keeps polling
    }
    if (order.orderType === 'ao_token_bundle') {
      return NextResponse.json({ ...base, creditedTokens: order.tokenQuantity });
    }
    if (order.downloadToken && !order.downloadConsumedAt) {
      return NextResponse.json({ ...base, downloadUrl: `/api/reports/download?token=${order.downloadToken}` });
    }
    return NextResponse.json({ ...base, downloadConsumed: Boolean(order.downloadConsumedAt) });
  } catch (err) {
    console.error('[order-status] error:', err);
    return NextResponse.json({ ok: false, error: 'Could not fetch order status.' }, { status: 500 });
  }
}
