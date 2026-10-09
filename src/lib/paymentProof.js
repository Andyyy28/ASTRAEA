export async function getPaymentProofUrl(client, orderId) {
  const { data, error } = await client.functions.invoke('admin-payment-proof', { body: { order_id: orderId } });
  if (error || !data?.signedUrl) throw new Error('Unable to securely load the payment proof.');
  const url = new URL(data.signedUrl);
  const projectOrigin = new URL(client.supabaseUrl).origin;
  if (url.origin !== projectOrigin || !url.pathname.startsWith('/storage/v1/object/sign/') || !url.searchParams.get('token')) {
    throw new Error('Invalid payment proof response.');
  }
  return url.href;
}
