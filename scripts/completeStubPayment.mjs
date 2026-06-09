// scripts/completeStubPayment.mjs
//
// Completes a stub-mode purchase by simulating the gateway's SIGNED success
// callback for an existing 'created' order, so you can watch tokens get
// credited and the dashboard balance update — without real Paypur keys.
//
// This is NOT a payment bypass: it signs the callback with PAYPUR_SECRET_KEY,
// exactly as the real gateway would. Without the secret it cannot forge a valid
// signature, and the webhook still runs every check (amount, status, idempotency).
//
// Usage:
//   node --env-file=.env.local scripts/completeStubPayment.mjs <orderId>
//
// Prereqs: dev server running; MONGODB_URI + PAYPUR_SECRET_KEY set.

import mongoose from 'mongoose';
import { computePaypurSignature } from '../lib/server/paypur.js';
import Order from '../models/Order.js';

const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:3000/api/payments/webhook';

async function main() {
  const orderId = process.argv[2];
  if (!orderId) throw new Error('Usage: node --env-file=.env.local scripts/completeStubPayment.mjs <orderId>');
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI not set');
  if (!process.env.PAYPUR_SECRET_KEY) throw new Error('PAYPUR_SECRET_KEY not set');

  await mongoose.connect(process.env.MONGODB_URI);
  const order = await Order.findById(orderId).lean();
  await mongoose.disconnect();
  if (!order) throw new Error('Order not found: ' + orderId);
  if (order.status === 'verified') {
    console.log('Order already verified — nothing to do.');
    return;
  }

  const fields = {
    client_order_id: orderId,
    order_id: order.gatewayOrderId || 'STUB-' + orderId,
    amount: (order.amountInPaise / 100).toString(),
    status: 'success',
    transaction_id: 'TXN-' + Date.now(),
    date: new Date().toISOString().slice(0, 10),
  };
  const payload = { ...fields, signature: computePaypurSignature(fields) };

  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  console.log('Webhook responded:', res.status, JSON.stringify(json));
  if (json.ok) {
    console.log(`\nDone. Re-open /payments/return?order=${orderId} (or refresh the dashboard) to see the result.`);
  } else {
    console.log('\nDid not complete — see the response above.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
