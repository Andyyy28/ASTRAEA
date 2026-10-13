const ERROR_MESSAGES = {
  NOT_FOUND: 'Checkout is temporarily unavailable. Please contact the store or try again later.',
  turnstile_required: 'Please complete the security check before placing your order.',
  turnstile_failed: 'The security check expired or could not be verified. Please complete the new check and try again.',
  turnstile_not_configured: 'Checkout is temporarily unavailable. Please contact the store or try again later.',
  turnstile_unavailable: 'The security service is temporarily unavailable. Please try again.',
  service_not_configured: 'Checkout is temporarily unavailable. Please contact the store or try again later.',
  checkout_session_unavailable: 'Your checkout session could not be started. Please try again.',
  rate_limit_unavailable: 'Checkout is temporarily unavailable. Please try again later.',
  rate_limited: 'Too many attempts. Please wait a few minutes before trying again.',
  quote_unavailable: 'Some items are no longer available. Please review your cart and try again.',
  proof_upload_failed: 'The payment proof could not be uploaded. Please try again.',
  invalid_proof: 'Please upload a JPEG, PNG or WebP payment proof smaller than 5 MB.',
};

// Supabase returns HTTP failures as errors whose context contains the response.
// Use only known codes; server messages may contain private implementation details.
export async function invokeGuestApi(client, body, fallback) {
  const { data, error } = await client.functions.invoke('guest-api', { body });
  if (!error && !data?.error) return data;
  let response = data;
  if (error?.context instanceof Response) {
    try { response = await error.context.clone().json(); } catch { /* non-JSON gateway response */ }
  }
  const code = response?.error || response?.code;
  throw new Error(ERROR_MESSAGES[code] || fallback || 'Checkout could not connect to the store. Please try again.');
}
