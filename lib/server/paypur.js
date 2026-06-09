import crypto from 'crypto';

// ----------------------------------------------------------------------------
// Paypur integration helpers (raw REST + MD5 callback signature).
//
// SECURITY NOTE: Paypur verifies callbacks with a plain MD5 over concatenated
// fields plus the secret key (secret appended LAST). This is weaker than an
// HMAC and its safety depends ENTIRELY on PAYPUR_SECRET_KEY staying secret.
// We therefore do NOT treat a valid signature as sufficient on its own — the
// webhook route also (a) re-checks the amount against the stored order,
// (b) requires status === 'success', and (c) is idempotent so a replayed
// callback cannot transition or double-credit an order twice.
// ----------------------------------------------------------------------------

const CREATE_ORDER_URL = 'https://api.paypur.in/api/v1/create/order';

export function isPaypurConfigured() {
  return Boolean(process.env.PAYPUR_API_KEY && process.env.PAYPUR_SECRET_KEY);
}

// Compute the Paypur callback signature:
//   md5(client_order_id + order_id + amount + status + transaction_id + date + secret_key)
// Values are concatenated as strings in this exact order, secret appended last.
export function computePaypurSignature({
  client_order_id,
  order_id,
  amount,
  status,
  transaction_id,
  date,
}) {
  const secret = process.env.PAYPUR_SECRET_KEY;
  if (!secret) throw new Error('PAYPUR_SECRET_KEY is not defined');
  const raw =
    String(client_order_id ?? '') +
    String(order_id ?? '') +
    String(amount ?? '') +
    String(status ?? '') +
    String(transaction_id ?? '') +
    String(date ?? '') +
    secret;
  return crypto.createHash('md5').update(raw, 'utf8').digest('hex');
}

// Constant-time comparison of two hex signatures (avoids timing leaks).
// Returns false on any length/format mismatch rather than throwing.
export function safeSignatureEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const av = a.trim().toLowerCase();
  const bv = b.trim().toLowerCase();
  if (av.length !== bv.length || av.length === 0) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(av, 'utf8'), Buffer.from(bv, 'utf8'));
  } catch {
    return false;
  }
}

// Verify a Paypur callback payload's signature. `payload` is the parsed object
// containing the signed fields plus `signature`.
export function verifyPaypurCallback(payload) {
  if (!payload || typeof payload !== 'object') return false;
  const expected = computePaypurSignature(payload);
  return safeSignatureEqual(expected, payload.signature);
}

// Create an order with Paypur via raw REST. Returns { ok, payment_url, order_id, raw }.
// In stub mode (no keys configured) returns a clearly-marked fake so the app
// builds and the flow is walkable without live credentials.
export async function createPaypurOrder({
  amountInRupees,
  clientOrderId,
  redirectUrl,
  name,
  email,
  mobile,
}) {
  if (!isPaypurConfigured()) {
    return {
      ok: true,
      stub: true,
      payment_url: `/payments/stub-checkout?order=${encodeURIComponent(clientOrderId)}`,
      order_id: 'STUB-' + clientOrderId,
      raw: { stub: true, message: 'Paypur not configured — returning stub payment URL.' },
    };
  }

  const body = {
    api_key: process.env.PAYPUR_API_KEY,
    amount: Number(amountInRupees),
    client_order_id: clientOrderId,
    redirect_url: redirectUrl,
    name: name || '',
    email: email || '',
    mobile: mobile || '',
  };

  let res, json;
  try {
    res = await fetch(CREATE_ORDER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error('[paypur] create order network error:', err);
    return { ok: false, error: 'Payment gateway unreachable.' };
  }

  try {
    json = await res.json();
  } catch {
    return { ok: false, error: 'Invalid response from payment gateway.' };
  }

  if (!res.ok || !json?.status || !json?.payment_url) {
    return { ok: false, error: json?.message || 'Payment gateway rejected the order.', raw: json };
  }

  return { ok: true, payment_url: json.payment_url, order_id: json.order_id, raw: json };
}

// Server-authoritative pricing. The client sends ONLY an intent string; the
// server decides the amount. Token-bundle amounts are resolved separately from
// the TokenBundle collection (passed in), never from the client.
export const FIXED_PRICES_RUPEES = {
  employee_report: 500,
  ao_report: 300,
};

export function priceForIntent(intent) {
  return Object.prototype.hasOwnProperty.call(FIXED_PRICES_RUPEES, intent)
    ? FIXED_PRICES_RUPEES[intent]
    : null;
}
