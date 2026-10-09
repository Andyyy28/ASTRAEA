import { HttpError, errorResponse, jsonResponse, readJson } from './http.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PROOF_BYTES = 5 * 1024 * 1024;
const ALLOWED_PROOF_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ACTION_LIMITS = {
  'start-checkout': [5, 600],
  quote: [30, 60],
  'proof-upload': [5, 3600],
  checkout: [5, 3600],
  review: [3, 3600],
  track: [10, 600],
};

const safeString = (value, name, max, required = true) => {
  if (typeof value !== 'string') {
    if (!required && (value === null || value === undefined)) return null;
    throw new HttpError(400, `invalid_${name}`);
  }
  const result = value.trim();
  if (required && !result) throw new HttpError(400, `invalid_${name}`);
  if (result.length > max) throw new HttpError(400, `${name}_too_long`);
  return result;
};

const assertKeys = (object, allowed) => {
  if (Object.keys(object).some(key => !allowed.includes(key))) throw new HttpError(400, 'invalid_request');
};

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function corsHeaders(request, allowedOrigins) {
  const origin = request.headers.get('origin');
  if (origin && !allowedOrigins.has(origin)) throw new HttpError(403, 'origin_not_allowed');
  if (!origin) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

async function verifyTurnstile(token, env, fetchImpl = fetch, expectedAction = null) {
  if (typeof token !== 'string' || token.length < 10 || token.length > 2048) throw new HttpError(400, 'turnstile_required');
  const secret = env('TURNSTILE_SECRET_KEY');
  if (!secret) throw new HttpError(503, 'turnstile_not_configured');
  let response;
  try {
    response = await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }),
      signal: AbortSignal.timeout(5000),
    });
    const result = await response.json();
    const expectedHostname = env('TURNSTILE_EXPECTED_HOSTNAME');
    if (!response.ok || result.success !== true || (expectedHostname && result.hostname !== expectedHostname) || (expectedAction && result.action !== expectedAction)) {
      throw new HttpError(403, 'turnstile_failed');
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, 'turnstile_unavailable');
  }
}

function withHeaders(response, headers) {
  if (!headers || Object.keys(headers).length === 0) return response;
  const merged = new Headers(response.headers);
  Object.entries(headers).forEach(([key, value]) => merged.set(key, value));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: merged });
}

function clientIdentity(request, sessionToken = '') {
  // Forwarded IP headers are intentionally ignored; they are client-controlled here.
  return [request.headers.get('user-agent') || 'unknown', request.headers.get('origin') || 'no-origin', sessionToken].join('|').slice(0, 12000);
}

async function consumeLimit(client, request, action, sessionToken) {
  const [limit, seconds] = ACTION_LIMITS[action] || [5, 600];
  const keyHash = await sha256Hex(`${action}|${clientIdentity(request, sessionToken)}`);
  const { data, error } = await client.rpc('consume_api_rate_limit', {
    p_key_hash: keyHash, p_action: action, p_limit: limit, p_window_seconds: seconds,
  });
  if (error) throw new HttpError(503, 'rate_limit_unavailable');
  if (data !== true) throw new HttpError(429, 'rate_limited');
}

function validateComponentArray(value, name) {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value) || value.length > 20) throw new HttpError(400, `invalid_${name}`);
  return value.map(component => {
    if (!component || typeof component !== 'object' || Array.isArray(component) || !UUID.test(component.id || '')) throw new HttpError(400, `invalid_${name}`);
    const quantity = Number(component.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) throw new HttpError(400, `invalid_${name}`);
    return { id: component.id, quantity, name: safeString(component.name, `${name}_name`, 160, false), color: safeString(component.color, `${name}_color`, 80, false) };
  });
}

function validateItem(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) throw new HttpError(400, 'invalid_items');
  const type = safeString(item.item_type, 'item_type', 20);
  if (!['bouquet', 'custom', 'other_product'].includes(type)) throw new HttpError(400, 'invalid_item_type');
  const quantity = Number(item.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) throw new HttpError(400, 'invalid_quantity');
  const output = { item_type: type, quantity };
  if (type === 'bouquet') {
    if (!UUID.test(item.bouquet_id || '')) throw new HttpError(400, 'invalid_bouquet');
    output.bouquet_id = item.bouquet_id;
  } else if (type === 'other_product') {
    if (!UUID.test(item.other_product_id || '')) throw new HttpError(400, 'invalid_product');
    output.other_product_id = item.other_product_id;
  } else {
    const size = safeString(item.size, 'size', 20);
    if (!['small', 'medium', 'large'].includes(size)) throw new HttpError(400, 'invalid_size');
    output.size = size;
    output.flowers = validateComponentArray(item.flowers, 'flowers');
    output.fillers = validateComponentArray(item.fillers, 'fillers');
    if (output.flowers.length === 0) throw new HttpError(400, 'invalid_flowers');
    if (item.wrapper !== null && item.wrapper !== undefined) {
      if (!item.wrapper || typeof item.wrapper !== 'object' || !UUID.test(item.wrapper.id || '')) throw new HttpError(400, 'invalid_wrapper');
      output.wrapper = { id: item.wrapper.id, material: safeString(item.wrapper.material, 'wrapper_material', 160, false), color: safeString(item.wrapper.color, 'wrapper_color', 80, false) };
    }
    if (item.addons !== null && item.addons !== undefined) {
      if (!item.addons || typeof item.addons !== 'object' || Array.isArray(item.addons)) throw new HttpError(400, 'invalid_addons');
      output.addons = Object.fromEntries(Object.entries(item.addons).filter(([key, enabled]) => {
        if (!/^[a-z0-9_-]{1,80}$/i.test(key) || typeof enabled !== 'boolean') throw new HttpError(400, 'invalid_addons');
        return enabled;
      }));
    }
  }
  const messageCard = safeString(item.message_card, 'message_card', 500, false);
  if (messageCard) output.message_card = messageCard;
  const instructions = safeString(item.instructions, 'instructions', 1000, false);
  if (instructions) output.instructions = instructions;
  return output;
}

function validateItems(items) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 50) throw new HttpError(400, 'invalid_items');
  return items.map(validateItem);
}

function validateOrder(order) {
  if (!order || typeof order !== 'object' || Array.isArray(order)) throw new HttpError(400, 'invalid_order');
  assertKeys(order, ['customer_name', 'contact_number', 'facebook_account', 'payment_method', 'delivery_method', 'delivery_address', 'preferred_date', 'preferred_time', 'special_notes']);
  const result = {
    customer_name: safeString(order.customer_name, 'customer_name', 160),
    contact_number: safeString(order.contact_number, 'contact_number', 40),
    facebook_account: safeString(order.facebook_account, 'facebook_account', 160),
    payment_method: safeString(order.payment_method, 'payment_method', 20).toLowerCase(),
    delivery_method: safeString(order.delivery_method, 'delivery_method', 20).toLowerCase(),
    delivery_address: safeString(order.delivery_address, 'delivery_address', 500, false),
    preferred_date: safeString(order.preferred_date, 'preferred_date', 20),
    preferred_time: safeString(order.preferred_time, 'preferred_time', 80, false),
    special_notes: safeString(order.special_notes, 'special_notes', 1000, false),
  };
  if (!['cash', 'gcash'].includes(result.payment_method)) throw new HttpError(400, 'invalid_payment_method');
  if (!['pickup', 'delivery'].includes(result.delivery_method)) throw new HttpError(400, 'invalid_delivery_method');
  if (result.delivery_method === 'delivery' && !result.delivery_address) throw new HttpError(400, 'delivery_address_required');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result.preferred_date) || Number.isNaN(Date.parse(`${result.preferred_date}T00:00:00Z`)) || new Date(`${result.preferred_date}T00:00:00Z`).toISOString().slice(0, 10) !== result.preferred_date) throw new HttpError(400, 'invalid_preferred_date');
  if (result.preferred_time && !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(result.preferred_time)) throw new HttpError(400, 'invalid_preferred_time');
  if (result.delivery_method === 'pickup' && !result.preferred_time) throw new HttpError(400, 'pickup_time_required');
  return result;
}

async function requireSession(client, sessionId, sessionToken, forCheckout = false) {
  if (!UUID.test(sessionId || '') || typeof sessionToken !== 'string' || sessionToken.length < 32) throw new HttpError(400, 'invalid_checkout_session');
  const tokenHash = await sha256Hex(sessionToken);
  if (forCheckout) {
    const { data, error } = await client.rpc('claim_checkout_session', { p_session_id: sessionId, p_token_hash: tokenHash });
    if (error || !data?.id) throw new HttpError(409, 'checkout_session_unavailable');
    return { session: data, tokenHash };
  }
  const { data, error } = await client.from('checkout_sessions').select('*').eq('id', sessionId).eq('token_hash', tokenHash).is('used_at', null).gt('expires_at', new Date().toISOString()).maybeSingle();
  if (error || !data) throw new HttpError(409, 'checkout_session_unavailable');
  return { session: data, tokenHash };
}

function proofSignature(bytes, contentType) {
  if (contentType === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (contentType === 'image/png') return bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value);
  return contentType === 'image/webp' && bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
}

async function uploadProof(client, request) {
  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_PROOF_BYTES + 256 * 1024) throw new HttpError(413, 'request_too_large');
  const form = await request.formData();
  const action = form.get('action');
  const sessionId = form.get('session_id');
  const sessionToken = form.get('session_token');
  if (action !== 'proof-upload') throw new HttpError(400, 'invalid_request');
  const { session } = await requireSession(client, sessionId, sessionToken);
  await consumeLimit(client, request, 'proof-upload', sessionToken);
  const file = form.get('file');
  if (!(file instanceof File) || !ALLOWED_PROOF_TYPES.has(file.type) || file.size < 1 || file.size > MAX_PROOF_BYTES) throw new HttpError(400, 'invalid_proof');
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!proofSignature(bytes, file.type)) throw new HttpError(400, 'invalid_proof');
  const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.slice('image/'.length);
  const path = `${session.id}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await client.storage.from('payment-proofs').upload(path, new Blob([bytes], { type: file.type }), { contentType: file.type, upsert: false });
  if (uploadError) throw new HttpError(503, 'proof_upload_failed');
  const proofPath = `payment-proofs/${path}`;
  const { error: updateError } = await client.from('checkout_sessions').update({ proof_path: proofPath, proof_content_type: file.type, proof_size: file.size }).eq('id', session.id).eq('token_hash', await sha256Hex(sessionToken)).is('used_at', null).gt('expires_at', new Date().toISOString());
  if (updateError) {
    await client.storage.from('payment-proofs').remove([path]);
    throw new HttpError(503, 'proof_upload_failed');
  }
  if (session.proof_path?.startsWith(`payment-proofs/${session.id}/`)) await client.storage.from('payment-proofs').remove([session.proof_path.slice('payment-proofs/'.length)]);
  return jsonResponse(200, { uploaded: true, contentType: file.type, size: file.size });
}

async function handleQuote(client, body, request) {
  assertKeys(body, ['action', 'session_id', 'session_token', 'items', 'delivery_method']);
  const sessionToken = safeString(body.session_token, 'session_token', 160);
  const { session } = await requireSession(client, body.session_id, sessionToken);
  await consumeLimit(client, request, 'quote', sessionToken);
  const items = validateItems(body.items);
  const deliveryMethod = safeString(body.delivery_method, 'delivery_method', 20).toLowerCase();
  if (!['pickup', 'delivery'].includes(deliveryMethod)) throw new HttpError(400, 'invalid_delivery_method');
  const quoteToken = `${crypto.randomUUID()}${crypto.randomUUID()}`;
  const { data, error } = await client.rpc('create_checkout_quote', {
    p_session_id: session.id,
    p_session_token_hash: await sha256Hex(sessionToken),
    p_quote_token_hash: await sha256Hex(quoteToken),
    p_items: items,
    p_delivery_method: deliveryMethod,
  });
  if (error || !data?.items || !data?.expires_at) throw new HttpError(400, 'quote_unavailable');
  return jsonResponse(200, { ...data, quote_token: quoteToken });
}

async function handleCheckout(client, body, request) {
  assertKeys(body, ['action', 'session_id', 'session_token', 'quote_token', 'request_uuid', 'order']);
  const order = validateOrder(body.order);
  const requestUuid = safeString(body.request_uuid, 'request_uuid', 80);
  if (!UUID.test(requestUuid)) throw new HttpError(400, 'invalid_request_uuid');
  const quoteToken = safeString(body.quote_token, 'quote_token', 160);
  const sessionToken = safeString(body.session_token, 'session_token', 160);
  await consumeLimit(client, request, 'checkout', sessionToken);
  const requestHash = await sha256Hex(JSON.stringify({ quote_token: await sha256Hex(quoteToken), order }));
  const { data, error } = await client.rpc('commit_checkout', {
    p_session_id: body.session_id,
    p_session_token_hash: await sha256Hex(sessionToken),
    p_quote_token_hash: await sha256Hex(quoteToken),
    p_request_uuid: requestUuid,
    p_request_hash: requestHash,
    p_order: order,
  });
  if (error || !data?.reference_number) {
    const message = String(error?.message || '').toLowerCase();
    if (message.includes('expired') || message.includes('session unavailable')) throw new HttpError(409, 'quote_expired');
    if (message.includes('already used')) throw new HttpError(409, 'request_uuid_reused');
    if (message.includes('stock')) throw new HttpError(409, 'stock_unavailable');
    throw new HttpError(400, 'checkout_failed');
  }
  return jsonResponse(200, data);
}

async function handleReview(client, body, request, env, fetchImpl) {
  assertKeys(body, ['action', 'turnstile_token', 'name', 'message', 'rating']);
  await verifyTurnstile(body.turnstile_token, env, fetchImpl, 'review');
  await consumeLimit(client, request, 'review', '', env);
  const name = safeString(body.name, 'name', 120);
  const message = safeString(body.message, 'message', 2000);
  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new HttpError(400, 'invalid_rating');
  const { data, error } = await client.from('reviews').insert({ name, message, rating, is_displayed: false, admin_reply: null }).select('id').single();
  if (error || !data?.id) throw new HttpError(503, 'review_unavailable');
  return jsonResponse(200, { submitted: true });
}

async function handleTrack(client, body, request, env) {
  assertKeys(body, ['action', 'reference', 'verification']);
  const reference = safeString(body.reference, 'reference', 80);
  const verification = safeString(body.verification, 'verification', 160);
  await consumeLimit(client, request, 'track', '', env);
  const { data, error } = await client.rpc('track_order', { p_reference: reference, p_verification: verification });
  if (error) throw new HttpError(503, 'tracking_unavailable');
  return jsonResponse(200, data || {});
}

export function createGuestApiHandler({ getEnv, createClient, fetchImpl = fetch }) {
  return async request => {
    let headers = {};
    try {
      const allowedOrigins = new Set((getEnv('ALLOWED_ORIGINS') || '').split(',').map(value => value.trim()).filter(Boolean));
      headers = corsHeaders(request, allowedOrigins);
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
      if (request.method !== 'POST') throw new HttpError(405, 'method_not_allowed');
      if (!getEnv('SUPABASE_URL') || !getEnv('SUPABASE_SERVICE_ROLE_KEY')) throw new HttpError(503, 'service_not_configured');
      const client = createClient();
      if (request.headers.get('content-type')?.toLowerCase().startsWith('multipart/form-data')) return withHeaders(await uploadProof(client, request), headers);
      const body = await readJson(request, 128 * 1024);
      const action = safeString(body.action, 'action', 40);
      if (action === 'start-checkout') {
        assertKeys(body, ['action', 'turnstile_token']);
        await verifyTurnstile(body.turnstile_token, getEnv, fetchImpl, 'checkout');
        await consumeLimit(client, request, action, '', getEnv);
        const sessionToken = `${crypto.randomUUID()}${crypto.randomUUID()}`;
        const tokenHash = await sha256Hex(sessionToken);
        const clientHash = await sha256Hex(clientIdentity(request));
        const { data, error } = await client.from('checkout_sessions').insert({ token_hash: tokenHash, client_hash: clientHash, turnstile_verified_at: new Date().toISOString(), expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString() }).select('id,expires_at').single();
        if (error || !data?.id) throw new HttpError(503, 'checkout_session_unavailable');
        return jsonResponse(200, { session_id: data.id, session_token: sessionToken, expires_at: data.expires_at }, headers);
      }
      if (action === 'quote') return withHeaders(await handleQuote(client, body, request), headers);
      if (action === 'checkout') return withHeaders(await handleCheckout(client, body, request), headers);
      if (action === 'review') return withHeaders(await handleReview(client, body, request, getEnv, fetchImpl), headers);
      if (action === 'track') return withHeaders(await handleTrack(client, body, request, getEnv), headers);
      throw new HttpError(400, 'invalid_action');
    } catch (error) { return errorResponse(error, headers); }
  };
}
