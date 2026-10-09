import test from 'node:test';
import assert from 'node:assert/strict';
import { createNotificationHandler, formatOrderNotification } from '../../supabase/functions/_shared/notifications.js';
import { createPaymentProofHandler, resolveProofReference } from '../../supabase/functions/_shared/paymentProof.js';
import { getPaymentProofUrl } from '../../src/lib/paymentProof.js';
import { sendOrderNotification, sendReviewNotification } from '../../src/lib/telegram.js';

const id = '11111111-1111-4111-8111-111111111111';
const claim = '22222222-2222-4222-8222-222222222222';
const project = 'https://project.example.test';
const secret = 'test-worker-credential-at-least-32-characters';
const env = { SUPABASE_URL: project, SUPABASE_SERVICE_ROLE_KEY: 'server-test-key', TELEGRAM_BOT_TOKEN: 'test-token', TELEGRAM_CHAT_ID: 'test-chat', NOTIFICATION_WORKER_SECRET: secret, ALLOWED_ORIGINS: 'https://store.example.test' };
const workerRequest = (token = secret) => new Request(`${project}/worker`, { method: 'POST', headers: { authorization: `Bearer ${token}` } });
const proofRequest = (body = { order_id: id }, origin = 'https://store.example.test') => new Request(`${project}/proof`, { method: 'POST', headers: { authorization: 'Bearer verified-session', 'content-type': 'application/json', origin }, body: JSON.stringify(body) });
function table(data, error = null) {
  const result = { data, error };
  const builder = { select: () => builder, eq: () => builder, single: async () => result, maybeSingle: async () => result, order: async () => result };
  return builder;
}
function workerFixture({ queueError = null, telegramOk = true, ack = true } = {}) {
  const calls = []; const sends = [];
  const client = {
    rpc: async (name, params) => {
      calls.push([name, params]);
      if (name === 'claim_notification_events') return { data: [{ id, entity_id: id, event_type: 'order.created', claim_token: claim, attempts: 1 }], error: queueError };
      return { data: name === 'complete_notification_event' ? ack : true, error: null };
    },
    from: name => table(name === 'orders' ? { reference_number: 'AC-TEST', customer_name: 'Stored customer', total_amount: 250, payment_method: 'gcash' } : [{ quantity: 2, bouquets: { name: 'Stored bouquet' } }]),
  };
  const handler = createNotificationHandler({ getEnv: key => env[key], createClient: () => client, fetchImpl: async (url, options) => {
    sends.push([url, JSON.parse(options.body)]);
    return new Response(JSON.stringify(telegramOk ? { ok: true } : { ok: false, parameters: { retry_after: 120 } }), { status: telegramOk ? 200 : 429 });
  } });
  return { handler, calls, sends };
}
test('worker rejects unauthorized access and caller payloads before database work', async () => {
  const f = workerFixture(); assert.equal((await f.handler(workerRequest('wrong'))).status, 401);
  const req = new Request(`${project}/worker`, { method: 'POST', headers: { authorization: `Bearer ${secret}` }, body: '{"entity_id":"attacker"}' });
  assert.equal((await f.handler(req)).status, 400); assert.equal(f.calls.length, 0); assert.equal(f.sends.length, 0);
});
test('worker loads canonical records and acknowledges only successful Telegram sends', async () => {
  const f = workerFixture(); const res = await f.handler(workerRequest()); assert.equal(res.status, 200); assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.equal((await res.json()).delivered, 1); assert.match(f.sends[0][1].text, /Stored bouquet/);
  assert.equal(f.calls[1][0], 'complete_notification_event'); assert.equal(f.calls[1][1].p_claim_token, claim);
});
test('Telegram failure is retried without acknowledging delivery', async () => {
  const f = workerFixture({ telegramOk: false }); const res = await f.handler(workerRequest()); assert.equal((await res.json()).retrying, 1);
  assert.equal(f.calls[1][0], 'retry_notification_event'); assert.equal(f.calls[1][1].p_retry_after_seconds, 120);
});
test('unacknowledged send is retried and missing outbox is a deployment failure', async () => {
  const f = workerFixture({ ack: false }); await f.handler(workerRequest()); assert.equal(f.calls[2][0], 'retry_notification_event');
  const missing = workerFixture({ queueError: { code: 'PGRST202' } }); assert.equal((await missing.handler(workerRequest())).status, 503); assert.equal(missing.sends.length, 0);
});
test('notification formatting escapes every free-text component and stays bounded', () => {
  const message = formatOrderNotification({ reference_number: '<ref>', customer_name: '<script>', total_amount: 20, special_notes: '&'.repeat(10000) }, [{ quantity: 1, size: '<large>', flowers: [{ name: '<rose>', color: '<red>', quantity: 2 }], wrapper: { material: '<paper>' }, addons: { '<addon>': true }, message_card: '<b>card</b>' }]);
  assert.ok(message.length < 4096); assert.ok(!message.includes('<script>')); assert.match(message, /&lt;rose&gt;/); assert.match(message, /&lt;b&gt;card&lt;\/b&gt;/);
});
test('browser compatibility exports never transmit or accept customer payloads', async () => {
  assert.deepEqual(await sendOrderNotification({ malicious: true }), { status: 'client-disabled' });
  assert.deepEqual(await sendReviewNotification({ malicious: true }), { status: 'client-disabled' });
});

function proofFixture({ admin = true, authError = null, membershipError = null, publicBucket = false, reference = `payment-proofs/${id}/${claim}.png`, extraEnv = {} } = {}) {
  const signed = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: { id, email_confirmed_at: '2026-01-01' } }, error: authError }) },
    from: name => name === 'admin_users' ? table(admin ? { user_id: id } : null, membershipError) : table({ payment_proof_url: reference }),
    storage: { getBucket: async () => ({ data: { public: publicBucket }, error: null }), from: bucket => ({ createSignedUrl: async (path, ttl) => {
      signed.push({ bucket, path, ttl }); return { data: { signedUrl: `${project}/storage/v1/object/sign/${bucket}/${path}?token=test` }, error: null };
    } }) },
  };
  return { signed, handler: createPaymentProofHandler({ getEnv: key => ({ ...env, ...extraEnv })[key], createClient: () => client }) };
}
test('proof access rejects invalid sessions, non-admins and failed authorization checks', async () => {
  for (const [options, status] of [[{ authError: {} }, 401], [{ admin: false }, 403], [{ membershipError: {} }, 503]]) {
    const f = proofFixture(options); assert.equal((await f.handler(proofRequest())).status, status); assert.equal(f.signed.length, 0);
  }
});
test('private proof signs only the persisted path after bucket privacy check', async () => {
  const f = proofFixture(); const res = await f.handler(proofRequest()); assert.equal(res.status, 200); assert.equal((await res.json()).visibility, 'private'); assert.deepEqual(f.signed, [{ bucket: 'payment-proofs', path: `${id}/${claim}.png`, ttl: 300 }]);
  const publicStorage = proofFixture({ publicBucket: true }); assert.equal((await publicStorage.handler(proofRequest())).status, 503); assert.equal(publicStorage.signed.length, 0);
});
test('proof rejects arbitrary paths, malformed input, oversized input and unrelated origins', async () => {
  const f = proofFixture();
  assert.equal((await f.handler(proofRequest({ order_id: id, path: 'secret.png' }))).status, 400);
  assert.equal((await f.handler(proofRequest({ order_id: 'invalid' }))).status, 400);
  assert.equal((await f.handler(proofRequest({ order_id: 'x'.repeat(5000) }))).status, 413);
  assert.equal((await f.handler(proofRequest({ order_id: id }, 'https://attacker.example.test'))).status, 403);
  assert.equal(f.signed.length, 0);
});
test('legacy URLs are disabled by default and constrained to this project when explicitly enabled', () => {
  const legacy = `${project}/storage/v1/object/public/bouquets/payment-proofs/123-original.jpg`;
  assert.throws(() => resolveProofReference(legacy, project));
  assert.equal(resolveProofReference(legacy, project, true).legacy, true);
  for (const ref of [legacy.replace(project, 'https://attacker.example.test'), `${legacy}?token=secret`, `${legacy}#fragment`, `${project}/storage/v1/object/public/bouquets/payment-proofs/a%2fb.jpg`, `${project}/storage/v1/object/public/bouquets/payment-proofs/a%2500.jpg`, `${project}/storage/v1/object/public/bouquets/other.jpg`]) assert.throws(() => resolveProofReference(ref, project, true));
});
test('legacy compatibility signs existing proof only, without claiming privacy', async () => {
  const f = proofFixture({ reference: `${project}/storage/v1/object/public/bouquets/payment-proofs/123-original.jpg`, extraEnv: { ALLOW_LEGACY_PUBLIC_PROOFS: 'true' } });
  const response = await f.handler(proofRequest()); assert.equal((await response.json()).visibility, 'legacy-public'); assert.equal(f.signed[0].bucket, 'bouquets');
});
test('frontend rejects unexpected signed URL origins and never falls back to raw URLs', async () => {
  const client = { supabaseUrl: project, functions: { invoke: async () => ({ data: { signedUrl: 'https://attacker.example.test/image' }, error: null }) } };
  await assert.rejects(getPaymentProofUrl(client, id));
  client.functions.invoke = async () => ({ error: { message: 'backend unavailable' } }); await assert.rejects(getPaymentProofUrl(client, id));
});
