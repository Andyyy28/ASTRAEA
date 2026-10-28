const ERROR_MESSAGES = {
  unauthorized: 'Your admin session has expired. Please sign in again.',
  forbidden: 'Your account does not have access to payment proofs.',
  authorization_unavailable: 'Admin access could not be verified. Please retry.',
  origin_not_allowed: 'Payment proof viewing is unavailable on this site.',
  private_bucket_required: 'Payment proof storage is temporarily unavailable. Please retry.',
  service_not_configured: 'Payment proof viewing is temporarily unavailable. Please retry.',
  NOT_FOUND: 'Payment proof viewing is temporarily unavailable. Please retry.',
  proof_unavailable: 'The payment receipt could not be retrieved. Please retry.',
};

export async function getPaymentProofUrl(client, orderId) {
  const { data, error } = await client.functions.invoke('admin-payment-proof', { body: { order_id: orderId } });
  if (error || !data?.signedUrl) {
    let response = data;
    if (error?.context instanceof Response) {
      try { response = await error.context.clone().json(); } catch { /* Non-JSON gateway failure. */ }
    }
    const code = response?.error || response?.code;
    throw new Error(Object.hasOwn(ERROR_MESSAGES, code) ? ERROR_MESSAGES[code] : 'Unable to load the payment proof. Please retry.');
  }
  const url = new URL(data.signedUrl);
  const projectOrigin = new URL(client.supabaseUrl).origin;
  if (url.origin !== projectOrigin || !url.pathname.startsWith('/storage/v1/object/sign/') || !url.searchParams.get('token')) {
    throw new Error('Invalid payment proof response.');
  }
  return url.href;
}
