import test from 'node:test';
import assert from 'node:assert/strict';
import { invokeGuestApi } from '../../src/lib/guestApi.js';

function httpFailure(body, status) {
  return { functions: { invoke: async () => ({ data: null, error: { context: new Response(JSON.stringify(body), { status }) } }) } };
}

test('a missing deployed function is reported as unavailable checkout, not a failed CAPTCHA', async () => {
  await assert.rejects(invokeGuestApi(httpFailure({ code: 'NOT_FOUND', message: 'Requested function was not found' }, 404), { action: 'start-checkout' }), /Checkout is temporarily unavailable/);
});

test('server failures after successful verification retain their actual cause', async () => {
  for (const code of ['turnstile_not_configured', 'rate_limit_unavailable', 'rate_limited', 'checkout_session_unavailable']) {
    await assert.rejects(invokeGuestApi(httpFailure({ error: code }, 503), {}), error => !/security check/i.test(error.message));
  }
  await assert.rejects(invokeGuestApi(httpFailure({ error: 'turnstile_failed' }, 403), {}), /security check expired/);
});

test('successful session responses and request bodies are passed through unchanged', async () => {
  const body = { action: 'start-checkout', turnstile_token: 'synthetic-token' };
  const session = { session_id: 'synthetic-id', session_token: 'synthetic-session-token' };
  const client = { functions: { invoke: async (name, options) => { assert.equal(name, 'guest-api'); assert.equal(options.body, body); return { data: session, error: null }; } } };
  assert.equal(await invokeGuestApi(client, body), session);
});

test('network and unrecognized backend errors use safe messages without exposing server details', async () => {
  const client = { functions: { invoke: async () => ({ error: { message: 'private credentials' }, data: null }) } };
  await assert.rejects(invokeGuestApi(client, {}, 'Please retry checkout.'), { message: 'Please retry checkout.' });
  await assert.rejects(invokeGuestApi(httpFailure({ error: 'unknown', message: 'private credentials' }, 500), {}, 'Please retry checkout.'), { message: 'Please retry checkout.' });
});
