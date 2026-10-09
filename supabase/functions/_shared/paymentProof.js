import { HttpError, bearerToken, errorResponse, jsonResponse, readJson } from './http.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRIVATE_REFERENCE = /^payment-proofs\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpg|jpeg|png|webp))$/i;

export function resolveProofReference(reference, projectUrl, allowLegacy = false) {
  if (typeof reference !== 'string') throw new HttpError(404, 'proof_unavailable');
  const match = PRIVATE_REFERENCE.exec(reference);
  if (match) return { bucket: 'payment-proofs', path: match[1], legacy: false };
  if (allowLegacy) {
    try {
      const url = new URL(reference);
      const prefix = '/storage/v1/object/public/bouquets/payment-proofs/';
      const file = decodeURIComponent(url.pathname.slice(prefix.length));
      if (url.origin === new URL(projectUrl).origin && url.pathname.startsWith(prefix)
        && !url.username && !url.password && !url.search && !url.hash
        && file && !/[/%\\]/.test(file) && !Array.from(file).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
        && file !== '.' && file !== '..'
        && /\.(jpg|jpeg|png|webp)$/i.test(file)) {
        return { bucket: 'bouquets', path: `payment-proofs/${file}`, legacy: true };
      }
    } catch { /* Invalid or unrelated URLs are never signed. */ }
  }
  throw new HttpError(404, 'proof_unavailable');
}

export function createPaymentProofHandler({ getEnv, createClient }) {
  return async request => {
    let headers = {};
    try {
      const origins = (getEnv('ALLOWED_ORIGINS') || '').split(',').map(value => value.trim()).filter(Boolean);
      const origin = request.headers.get('origin');
      if (origin && !origins.includes(origin)) throw new HttpError(403, 'origin_not_allowed');
      headers = origin ? {
        'Access-Control-Allow-Origin': origin, 'Vary': 'Origin',
        'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      } : {};
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
      if (request.method !== 'POST') throw new HttpError(405, 'method_not_allowed');
      const token = bearerToken(request);
      if (!getEnv('SUPABASE_URL') || !getEnv('SUPABASE_SERVICE_ROLE_KEY')) throw new HttpError(503, 'service_not_configured');
      const client = createClient();
      // getUser verifies the JWT with Supabase Auth, rather than trusting decoding.
      const { data: auth, error: authError } = await client.auth.getUser(token);
      if (authError || !auth?.user?.id || !auth.user.email_confirmed_at || auth.user.is_anonymous) throw new HttpError(401, 'unauthorized');
      const { data: membership, error: membershipError } = await client.from('admin_users')
        .select('user_id').eq('user_id', auth.user.id).maybeSingle();
      if (membershipError) throw new HttpError(503, 'authorization_unavailable');
      if (membership?.user_id !== auth.user.id) throw new HttpError(403, 'forbidden');
      const body = await readJson(request);
      if (Object.keys(body).length !== 1 || !UUID.test(body.order_id)) throw new HttpError(400, 'invalid_request');
      const { data: order, error } = await client.from('orders').select('payment_proof_url').eq('id', body.order_id).single();
      if (error || !order) throw new HttpError(404, 'proof_unavailable');
      const proof = resolveProofReference(order.payment_proof_url, getEnv('SUPABASE_URL'), getEnv('ALLOW_LEGACY_PUBLIC_PROOFS') === 'true');
      if (!proof.legacy) {
        const { data: bucket, error: bucketError } = await client.storage.getBucket(proof.bucket);
        if (bucketError || !bucket || bucket.public !== false) throw new HttpError(503, 'private_bucket_required');
      }
      const { data: signed, error: signError } = await client.storage.from(proof.bucket).createSignedUrl(proof.path, 300);
      if (signError || !signed?.signedUrl) throw new HttpError(503, 'proof_unavailable');
      return jsonResponse(200, { signedUrl: signed.signedUrl, expiresIn: 300, visibility: proof.legacy ? 'legacy-public' : 'private' }, headers);
    } catch (error) { return errorResponse(error, headers); }
  };
}
