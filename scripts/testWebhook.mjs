// scripts/testWebhook.mjs
//
// Exercises the payment webhook end-to-end WITHOUT live Paypur, by building a
// correctly-signed callback (same MD5 logic the server uses) and POSTing it to
// your local /api/payments/webhook.
//
// Prerequisites:
//   1. Dev server running:        npm run dev      (http://localhost:3000)
//   2. .env.local has MONGODB_URI (live Atlas) AND PAYPUR_SECRET_KEY (any test
//      value). Keep PAYPUR_API_KEY blank so create-order stays in stub mode.
//   3. ao_test seeded:            node --env-file=.env.local scripts/seedAO.mjs
//
// Run:
//   node --env-file=.env.local scripts/testWebhook.mjs
//
// It runs three checks:
//   A) Happy path  — POST a valid 'success' callback -> order becomes 'verified',
//      AO credited with the bundle's tokens, exactly one TokenLedger entry.
//   B) Idempotency — POST the SAME callback again -> acknowledged as idempotent,
//      NO second credit (ledger still has exactly one entry, balance unchanged).
//   C) Amount tamper — a freshly-created order with a correctly-signed but WRONG
//      amount -> rejected (server re-checks amount, never trusts the callback).
//
// NOTE: each full run credits the AO by the bundle size (10), so the balance
// grows by 10 per run. That's expected for a test harness.

import mongoose from 'mongoose';
import { computePaypurSignature } from '../lib/server/paypur.js';
import AccountOfficer from '../models/AccountOfficer.js';
import TokenBundle from '../models/TokenBundle.js';
import Order from '../models/Order.js';
import TokenLedger from '../models/TokenLedger.js';

const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:3000/api/payments/webhook';

function todayStr() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

async function postCallback(payload, label) {
  let res, json;
  try {
    res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error(`  ${label}: could not reach ${WEBHOOK_URL} — is the dev server running?`);
    throw err;
  }
  try {
    json = await res.json();
  } catch {
    json = { unparseable: true };
  }
  console.log(`  ${label}: HTTP ${res.status} -> ${JSON.stringify(json)}`);
  return { status: res.status, json };
}

function signedCallback(order, { amountOverride } = {}) {
  const fields = {
    client_order_id: order._id.toString(),
    order_id: 'TEST-GW-' + order._id.toString().slice(-6),
    amount: (amountOverride != null ? amountOverride : order.amountInPaise / 100).toString(),
    status: 'success',
    transaction_id: 'TXN-' + Date.now(),
    date: todayStr(),
  };
  return { ...fields, signature: computePaypurSignature(fields) };
}

async function makeBundleOrder(ao, bundle) {
  return Order.create({
    orderType: 'ao_token_bundle',
    payer: { kind: 'account_officer', ref: ao._id, refModel: 'AccountOfficer' },
    amountInPaise: bundle.priceInPaise,
    currency: 'INR',
    tokenBundle: bundle._id,
    tokenQuantity: bundle.tokenQuantity,
    isTestMode: true,
    status: 'created',
  });
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI not set');
  if (!process.env.PAYPUR_SECRET_KEY) {
    throw new Error(
      'PAYPUR_SECRET_KEY not set. Add any test value to .env.local so this script and the ' +
        'server sign identically, then restart the dev server.'
    );
  }

  console.log('Webhook target:', WEBHOOK_URL, '\n');
  await mongoose.connect(process.env.MONGODB_URI);

  const ao = await AccountOfficer.findOne({ loginId: 'ao_test' });
  if (!ao) throw new Error('ao_test not found — run seedAO.mjs first.');
  const balanceBefore = ao.tokenBalance ?? 0;

  let bundle = await TokenBundle.findOne({ name: 'Test Bundle 10' });
  if (!bundle) {
    bundle = await TokenBundle.create({
      name: 'Test Bundle 10',
      tokenQuantity: 10,
      priceInPaise: 10000,
      isActive: true,
    });
    console.log('Created test bundle "Test Bundle 10":', bundle._id.toString());
  }

  // ---- A) Happy path ----
  console.log('\n[A] Happy path');
  const orderA = await makeBundleOrder(ao, bundle);
  console.log('  created order', orderA._id.toString(), '| amountInPaise', orderA.amountInPaise);
  const payloadA = signedCallback(orderA);
  await postCallback(payloadA, 'POST #1 (expect Payment verified)');

  // ---- B) Idempotency: same callback again ----
  console.log('\n[B] Idempotency (re-deliver same callback)');
  await postCallback(payloadA, 'POST #2 (expect idempotent: true)');

  // ---- C) Amount tamper on a fresh order ----
  console.log('\n[C] Amount tamper (valid signature, wrong amount)');
  const orderC = await makeBundleOrder(ao, bundle);
  console.log('  created order', orderC._id.toString(), '| real amountInPaise', orderC.amountInPaise);
  const payloadC = signedCallback(orderC, { amountOverride: 1 }); // signs amount=1, real is 100
  await postCallback(payloadC, 'POST #3 (expect Amount mismatch / 400)');

  // ---- Results ----
  const aoAfter = await AccountOfficer.findById(ao._id);
  const ledgerA = await TokenLedger.find({ relatedOrder: orderA._id }).lean();
  const ledgerC = await TokenLedger.find({ relatedOrder: orderC._id }).lean();
  const finalA = await Order.findById(orderA._id);
  const finalC = await Order.findById(orderC._id);

  console.log('\n=== RESULTS ===');
  console.log('Order A status          :', finalA.status, '(expect: verified)');
  console.log('Order C status          :', finalC.status, '(expect: NOT verified — failed/created)');
  console.log('AO balance before       :', balanceBefore);
  console.log('AO balance after        :', aoAfter.tokenBalance, `(expect: ${balanceBefore + bundle.tokenQuantity})`);
  console.log('Ledger entries (order A):', ledgerA.length, '(expect: 1 — idempotency held)');
  console.log('Ledger entries (order C):', ledgerC.length, '(expect: 0 — tampered call credited nothing)');
  for (const e of ledgerA) {
    console.log(`   A ledger: delta=${e.delta} reason=${e.reason} balanceAfter=${e.balanceAfter}`);
  }

  const pass =
    finalA.status === 'verified' &&
    finalC.status !== 'verified' &&
    aoAfter.tokenBalance === balanceBefore + bundle.tokenQuantity &&
    ledgerA.length === 1 &&
    ledgerC.length === 0;

  console.log('\n' + (pass ? 'ALL CHECKS PASSED ✅' : 'SOME CHECKS FAILED ❌ — see values above'));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
