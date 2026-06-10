// Single shared SMS utility. All OTP senders (AO login, employee checkout,
// wizard Step 0) call sendOtpSms() here.
//
// Live mode: POST to Fast2SMS bulkV2 with the API key in the `authorization`
// header. Dry-run mode (SMS_DRY_RUN=true OR no FAST2SMS_API_KEY): log the code
// to the server console instead. The OTP is NEVER returned in an API response,
// so the dry-run path can't become a client-visible backdoor.
//
// DLT: default route is "otp" (Fast2SMS's built-in OTP template — fine for
// testing). To switch to a DLT-approved template later, set env vars WITHOUT
// code changes:
//   FAST2SMS_ROUTE=dlt
//   FAST2SMS_SENDER_ID=<your 3–6 char sender/header>
//   FAST2SMS_DLT_MESSAGE_ID=<approved message/template id>

const FAST2SMS_URL = 'https://www.fast2sms.com/dev/bulkV2';

function normalizeNumber(phone) {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d;
}

function isDryRun() {
  return process.env.SMS_DRY_RUN === 'true' || !process.env.FAST2SMS_API_KEY;
}

// Build the Fast2SMS request body. Default "otp" route just needs the code +
// number; the "dlt" route additionally carries sender_id and the template id.
function buildBody(number, otp) {
  const route = process.env.FAST2SMS_ROUTE || 'otp';
  const body = {
    route,
    variables_values: String(otp),
    numbers: number,
  };
  if (route === 'dlt' || route === 'dlt_manual') {
    if (process.env.FAST2SMS_SENDER_ID) body.sender_id = process.env.FAST2SMS_SENDER_ID;
    if (process.env.FAST2SMS_DLT_MESSAGE_ID) body.message = process.env.FAST2SMS_DLT_MESSAGE_ID;
    body.flash = 0;
  }
  return body;
}

export async function sendOtpSms(phone, otp) {
  const number = normalizeNumber(phone);

  if (isDryRun()) {
    console.log(`[sms:dry-run] OTP for +91${number} is ${otp} (not sent — dry-run mode).`);
    return { sent: false, dryRun: true };
  }

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
    console.error('[sms] Fast2SMS network error:', err);
    throw new Error('SMS gateway unreachable');
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  // Fast2SMS signals success with { return: true } and failure with { return: false }.
  if (!res.ok || data?.return === false) {
    console.error('[sms] Fast2SMS error:', res.status, JSON.stringify(data));
    throw new Error('SMS gateway returned an error');
  }

  return { sent: true, dryRun: false, requestId: data?.request_id };
}
