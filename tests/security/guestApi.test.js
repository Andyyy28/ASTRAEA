import test from 'node:test';
import assert from 'node:assert/strict';
import { createGuestApiHandler } from '../../supabase/functions/_shared/guestApi.js';
import { parseLegacyReference, detectImageType } from '../../scripts/migratePaymentProofs.js';

const id = '11111111-1111-4111-8111-111111111111';
const product = '22222222-2222-4222-8222-222222222222';
const origin = 'https://store.example.test';
const token = 'test-session-token-with-at-least-32-characters';
const quoteToken = 'test-quote-token-with-at-least-32-characters';
const env = { SUPABASE_URL: 'https://project.example.test', SUPABASE_SERVICE_ROLE_KEY: 'service-test', ALLOWED_ORIGINS: origin, TURNSTILE_SECRET_KEY: 'server-secret', TURNSTILE_EXPECTED_HOSTNAME: 'store.example.test' };
const order = { customer_name: 'Test', contact_number: '09123456789', facebook_account: 'Test', payment_method: 'cash', delivery_method: 'pickup', preferred_date: '2099-09-30', preferred_time: '10:00' };
const items = [{ item_type: 'bouquet', bouquet_id: product, quantity: 1 }];
const request = (body, headers = {}) => new Request('https://project.example.test/guest', { method: 'POST', headers: { 'content-type': 'application/json', origin, 'user-agent': 'test-agent', ...headers }, body: JSON.stringify(body) });
function builder(data, error = null) {
  const result = { data, error };
  const query = { select: () => query, eq: () => query, is: () => query, gt: () => query, update: () => query, insert: () => query, single: async () => result, maybeSingle: async () => result, then: resolve => resolve(result) };
  return query;
}
function fixture({ rateAllowed = true, turnstileSuccess = true, session = {}, rpcError = null } = {}) {
  const calls = []; const uploads = []; const inserts = [];
  const current = { id, proof_path: null, token_hash: 'a'.repeat(64), used_at: null, expires_at: '2099-10-01T00:00:00Z', ...session };
  const client = {
    rpc: async (name, args) => {
      calls.push([name, args]);
      if (name === 'consume_api_rate_limit') return { data: rateAllowed, error: null };
      if (name === 'create_checkout_quote') return { data: { items, delivery_method: 'pickup', delivery_fee: 0, total: 100, expires_at: '2099-10-01T00:15:00Z' }, error: null };
      if (name === 'commit_checkout') return { data: { id, order_id: id, reference_number: 'AC-TEST', total_amount: 100 }, error: rpcError };
      if (name === 'track_order') return { data: { order: { reference_number: 'AC-TEST', status: 'pending' }, items: [] }, error: null };
      return { data: true, error: null };
    },
    from: name => {
      if (name === 'checkout_sessions') {
        const query = builder(current);
        query.insert = data => { inserts.push([name, data]); return builder({ id, expires_at: '2099-10-01T00:15:00Z' }); };
        return query;
      }
      const query = builder({ id }); query.insert = data => { inserts.push([name, data]); return query; }; return query;
    },
    storage: { from: bucket => ({ upload: async (path, file, options) => { uploads.push({ bucket, path, file, options }); return { error: null }; }, remove: async () => ({ error: null }) }) },
  };
  const handler = createGuestApiHandler({ getEnv: key => env[key], createClient: () => client, fetchImpl: async (url, options) => new Response(JSON.stringify({ success: turnstileSuccess, hostname: 'store.example.test', action: new URLSearchParams(options.body).get('response')?.includes('review') ? 'review' : 'checkout' }), { status: 200 }) });
  return { handler, calls, uploads, inserts };
}

test('guest API restricts origins and requires server-verified Turnstile', async () => {
  const f = fixture({ turnstileSuccess: false });
  assert.equal((await f.handler(request({ action: 'start-checkout', turnstile_token: 'captcha-test-token' }, { origin: 'https://attacker.test' }))).status, 403);
  assert.equal((await f.handler(request({ action: 'start-checkout', turnstile_token: 'captcha-test-token' }))).status, 403);
  assert.equal(f.inserts.length, 0);
});

test('rate-limit identifiers are hashed and ignore forwarding headers', async () => {
  const f = fixture();
  await f.handler(request({ action: 'track', reference: 'AC-TEST', verification: '09123456789' }, { 'x-forwarded-for': 'attacker-A' }));
  await f.handler(request({ action: 'track', reference: 'AC-TEST', verification: '09123456789' }, { 'x-forwarded-for': 'attacker-B' }));
  const keys = f.calls.filter(([name]) => name === 'consume_api_rate_limit').map(([, args]) => args.p_key_hash);
  assert.match(keys[0], /^[0-9a-f]{64}$/); assert.equal(keys[0], keys[1]);
});

test('tracking is rate-limited and responses allow only configured browser origins', async () => {
  const limited = fixture({ rateAllowed: false });
  assert.equal((await limited.handler(request({ action: 'track', reference: 'AC-TEST', verification: 'x' }))).status, 429);
  const f = fixture(); const res = await f.handler(request({ action: 'track', reference: 'AC-TEST', verification: 'x' }));
  assert.equal(res.headers.get('access-control-allow-origin'), origin); assert.equal(res.headers.get('cache-control'), 'no-store'); assert.equal(JSON.stringify(await res.json()).includes('proof'), false);
});

test('quote returns a canonical aggregate and opaque token', async () => {
  const f = fixture(); const res = await f.handler(request({ action: 'quote', session_id: id, session_token: token, items, delivery_method: 'pickup' }));
  assert.equal(res.status, 200); const body = await res.json(); assert.equal(body.total, 100); assert.equal(body.delivery_fee, 0); assert.match(body.quote_token, /^[0-9a-f-]{72}$/); assert.ok(f.calls.some(([name]) => name === 'create_checkout_quote'));
});

test('checkout rejects malformed or incomplete contract before commit', async () => {
  const f = fixture();
  assert.equal((await f.handler(request({ action: 'checkout', session_id: id, session_token: token, quote_token: quoteToken, request_uuid: 'bad', order }))).status, 400);
  assert.equal(f.calls.some(([name]) => name === 'commit_checkout'), false);
});

test('checkout submits only the quote token, request UUID, and validated order', async () => {
  const proof = `payment-proofs/${id}/${product}.png`; const f = fixture({ session: { proof_path: proof } });
  const res = await f.handler(request({ action: 'checkout', session_id: id, session_token: token, quote_token: quoteToken, request_uuid: product, order: { ...order, payment_method: 'gcash' } }));
  assert.equal(res.status, 200); const commit = f.calls.find(([name]) => name === 'commit_checkout'); assert.match(commit[1].p_session_token_hash, /^[0-9a-f]{64}$/); assert.match(commit[1].p_quote_token_hash, /^[0-9a-f]{64}$/); assert.equal(commit[1].p_order.payment_proof_url, undefined);
});

test('legacy stock mutation actions are no longer exposed through the guest API', async () => {
  const f = fixture(); assert.equal((await f.handler(request({ action: 'stock-reserve', bouquet_id: product, quantity: 1 }))).status, 400); assert.equal(f.calls.some(([name]) => name.includes('stock')), false);
});

test('proof upload checks signature, type and size and creates a random session-bound object', async () => {
  const f = fixture();
  const uploadRequest = (bytes, type) => { const form = new FormData(); form.set('action', 'proof-upload'); form.set('session_id', id); form.set('session_token', token); form.set('file', new File([bytes], 'customer.png', { type })); return new Request('https://project.example.test/guest', { method: 'POST', headers: { origin, 'user-agent': 'test-agent' }, body: form }); };
  assert.equal((await f.handler(uploadRequest('not an image', 'image/png'))).status, 400); assert.equal((await f.handler(uploadRequest(new Uint8Array(5 * 1024 * 1024 + 1), 'image/png'))).status, 400);
  const res = await f.handler(uploadRequest(new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]), 'image/png')); assert.equal(res.status, 200); assert.equal(f.uploads[0].bucket, 'payment-proofs'); assert.match(f.uploads[0].path, new RegExp(`^${id}/[0-9a-f-]{36}\\.png$`)); assert.equal(JSON.stringify(await res.json()).includes('proof_path'), false);
});

test('reviews require Turnstile, enforce bounds and force moderation defaults', async () => {
  const f = fixture(); const res = await f.handler(request({ action: 'review', turnstile_token: 'review-captcha-test-token', name: 'Test', message: 'Thank you', rating: 5 }));
  assert.equal(res.status, 200); assert.deepEqual(f.inserts[0][1], { name: 'Test', message: 'Thank you', rating: 5, is_displayed: false, admin_reply: null }); assert.equal((await f.handler(request({ action: 'review', turnstile_token: 'review-captcha-test-token', name: 'Test', message: 'x', rating: 99 }))).status, 400);
});

test('legacy migration parsing accepts only project proof URLs and signatures', () => {
  const project = env.SUPABASE_URL; assert.deepEqual(parseLegacyReference(`${project}/storage/v1/object/public/bouquets/payment-proofs/a.png`, project), { bucket: 'bouquets', path: 'payment-proofs/a.png' }); assert.equal(parseLegacyReference('https://attacker.test/storage/v1/object/public/bouquets/payment-proofs/a.png', project), null); assert.equal(detectImageType(new Uint8Array([0xff,0xd8,0xff])), 'image/jpeg'); assert.equal(detectImageType(new Uint8Array([1,2,3])), null);
});
