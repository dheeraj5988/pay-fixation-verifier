// SMS sender. Production + real key -> Fast2SMS. Dev / SMS_DRY_RUN=true / no key ->
// logs the OTP to the server console instead. The OTP is NEVER returned in an API
// response; the dry-run path is env-gated and cannot ship as a client backdoor.

function isDryRun() {
  return (
    process.env.NODE_ENV !== 'production' ||
    process.env.SMS_DRY_RUN === 'true' ||
    !process.env.FAST2SMS_API_KEY
  );
}

export async function sendOtpSms(phone, otp) {
  if (isDryRun()) {
    console.log(`[sms:dry-run] OTP for ${phone} is ${otp} (not sent — dev/dry-run mode).`);
    return { sent: false, dryRun: true };
  }

  const url = 'https://www.fast2sms.com/dev/bulkV2';
  const params = new URLSearchParams({
    authorization: process.env.FAST2SMS_API_KEY,
    route: 'otp',
    variables_values: String(otp),
    numbers: String(phone).replace(/^(\+?91)/, ''),
  });

  let res;
  try {
    res = await fetch(`${url}?${params.toString()}`, { method: 'GET' });
  } catch (err) {
    console.error('[sms] Fast2SMS network error:', err);
    throw new Error('SMS gateway unreachable');
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('[sms] Fast2SMS error response:', res.status, text);
    throw new Error('SMS gateway returned an error');
  }
  return { sent: true, dryRun: false };
}
