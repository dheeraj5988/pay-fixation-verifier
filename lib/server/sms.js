// Single shared SMS utility. All OTP senders (AO login, employee checkout,
// wizard Step 0) call sendOtpSms() here.
//
// Live mode: POST to Fast2SMS bulkV2 with the API key in the `authorization`
// header. Dry-run mode (SMS_DRY_RUN=true OR no FAST2SMS_API_KEY): log the code
// to the server console instead.
//
// On a live failure this logs the FULL Fast2SMS response so you can see exactly
// why (bad key, DLT/template issue, etc.) and throws an SmsError so callers can
// distinguish an SMS-gateway failure from a database failure.
//
// DLT (set env vars, no code change):
//   FAST2SMS_ROUTE=dlt
//   FAST2SMS_SENDER_ID=<your 3–6 char sender/header>
//   FAST2SMS_DLT_MESSAGE_ID=<approved message/template id>

const FAST2SMS_URL = 'https://www.fast2sms.com/dev/bulkV2';

// Tagged error so routes can tell "SMS gateway failed" from "DB unreachable".
export class SmsError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'SmsError';
    this.isSmsError = true;
    this.details = details;
  }
}

function normalizeNumber(phone) {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d;
}

function isDryRun() {
  return process.env.SMS_DRY_RUN === 'true' || !process.env.FAST2SMS_API_KEY;
}

function buildBody(number, otp) {
  const route = process.env.FAST2SMS_ROUTE || 'otp';
  const body = { route, variables_values: String(otp), numbers: number };
  if (route === 'dlt' || route === 'dlt_manual') {
    if (process.env.FAST2SMS_SENDER_ID) body.sender_id = process.env.FAST2SMS_SENDER_ID;
    if (process.env.FAST2SMS_DLT_MESSAGE_ID) body.message = process.env.FAST2SMS_DLT_MESSAGE_ID;
    body.flash = 0;
  }
  return body;
}

export async function sendOtpSms(phone, otp) {
  const number = normalizeNumber(phone);
  const masked = `xxxxxx${number.slice(-4)}`;

  if (isDryRun()) {
    console.log(`[sms:dry-run] OTP for +91${number} is ${otp} (not sent — dry-run mode).`);
    return { sent: false, dryRun: true };
  }

  const route = process.env.FAST2SMS_ROUTE || 'otp';

  let res;
  try {
    res = await fetch(FAST2SMS_URL, {
      method: 'POST',
      headers: {
        authorization: process.env.FAST2SMS_API_KEY,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
      body: JSON.stringify(buildBody(number, otp)),
    });
  } catch (err) {
    console.error('[sms] ❌ NETWORK error reaching Fast2SMS:', err?.message || err);
    throw new SmsError('SMS gateway unreachable', { kind: 'network', cause: err?.message });
  }

  // Read once as text, then try to parse — so we can log raw bodies too.
  const raw = await res.text().catch(() => '');
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }

  // Fast2SMS: success => { return: true, request_id, ... }; failure => { return: false, status_code, message }.
  const failed = !res.ok || data?.return === false;
  if (failed) {
    console.error('[sms] ❌ Fast2SMS REJECTED the OTP send');
    console.error('[sms]    to (masked): +91' + masked);
    console.error('[sms]    route:       ' + route);
    console.error('[sms]    HTTP:        ' + res.status + ' ' + (res.statusText || ''));
    console.error('[sms]    Fast2SMS payload: ' + (data ? JSON.stringify(data) : raw || '(empty body)'));
    if (data?.message) console.error('[sms]    >>> Fast2SMS message: ' + JSON.stringify(data.message));
    throw new SmsError('Fast2SMS rejected the request', {
      kind: 'gateway',
      httpStatus: res.status,
      statusCode: data?.status_code,
      fast2smsMessage: data?.message,
      payload: data ?? raw,
    });
  }

  return { sent: true, dryRun: false, requestId: data?.request_id };
}
