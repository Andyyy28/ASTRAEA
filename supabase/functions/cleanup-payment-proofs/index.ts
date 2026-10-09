import { createClient } from 'npm:@supabase/supabase-js@2.106.1';
import { HttpError, bearerToken, errorResponse, jsonResponse, secureEquals } from '../_shared/http.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_MS = 24 * 60 * 60 * 1000;

function headersFor(request, env) {
  const origins = (env('ALLOWED_ORIGINS') || '').split(',').map(value => value.trim()).filter(Boolean);
  const origin = request.headers.get('origin');
  if (origin && !origins.includes(origin)) throw new HttpError(403, 'origin_not_allowed');
  return origin ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' } : {};
}

export function createCleanupHandler({ getEnv, createClient }) {
  return async request => {
    let headers = {};
    try {
      headers = headersFor(request, getEnv);
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
      if (request.method !== 'POST') throw new HttpError(405, 'method_not_allowed');
      const expected = getEnv('CLEANUP_SECRET') || getEnv('NOTIFICATION_WORKER_SECRET');
      if (!expected || !(await secureEquals(bearerToken(request), expected))) throw new HttpError(401, 'unauthorized');
      if (!getEnv('SUPABASE_URL') || !getEnv('SUPABASE_SERVICE_ROLE_KEY')) throw new HttpError(503, 'service_not_configured');
      const client = createClient();
      const { error: reservationError } = await client.rpc('release_expired_guest_stock_reservations');
      if (reservationError) throw new HttpError(503, 'cleanup_unavailable');
      const { error: rateLimitError } = await client.from('api_rate_limits').delete().lt('expires_at', new Date().toISOString());
      if (rateLimitError) throw new HttpError(503, 'cleanup_unavailable');
      const cutoff = Date.now() - DAY_MS;
      const { data: folders, error: folderError } = await client.storage.from('payment-proofs').list('', { limit: 1000, sortBy: { column: 'name', order: 'asc' } });
      if (folderError) throw new HttpError(503, 'cleanup_unavailable');
      let removed = 0;
      for (const folder of folders || []) {
        if (!UUID.test(folder.name || '')) continue;
        const { data: session, error: sessionError } = await client.from('checkout_sessions').select('id,expires_at,used_at,order_id').eq('id', folder.name).maybeSingle();
        if (sessionError) throw new HttpError(503, 'cleanup_unavailable');
        if (session?.used_at || session?.order_id || (session && new Date(session.expires_at).getTime() > Date.now())) continue;
        const { data: objects, error: objectError } = await client.storage.from('payment-proofs').list(folder.name, { limit: 1000 });
        if (objectError) throw new HttpError(503, 'cleanup_unavailable');
        const candidates = (objects || []).filter(object => object.name && object.updated_at && new Date(object.updated_at).getTime() < cutoff);
        if (!candidates.length) continue;
        const candidatePaths = candidates.map(object => `payment-proofs/${folder.name}/${object.name}`);
        const { data: referencedOrders, error: referenceError } = await client.from('orders').select('payment_proof_url').in('payment_proof_url', candidatePaths);
        if (referenceError) throw new HttpError(503, 'cleanup_unavailable');
        const referenced = new Set((referencedOrders || []).map(order => order.payment_proof_url));
        const stale = candidates.filter(object => !referenced.has(`payment-proofs/${folder.name}/${object.name}`));
        if (!stale.length) continue;
        const paths = stale.map(object => `${folder.name}/${object.name}`);
        const { error: removeError } = await client.storage.from('payment-proofs').remove(paths);
        if (removeError) throw new HttpError(503, 'cleanup_unavailable');
        removed += paths.length;
      }
      return jsonResponse(200, { removed }, headers);
    } catch (error) { return errorResponse(error, headers); }
  };
}

Deno.serve(createCleanupHandler({
  getEnv: name => Deno.env.get(name),
  createClient: () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } }),
}));
