import test from 'node:test';
import assert from 'node:assert/strict';
import { newRequestUuid, readPendingCheckout, writePendingCheckout, clearPendingCheckout } from '../../src/lib/checkoutRecovery.js';
import { validatePublicEnv } from '../../scripts/buildConfig.js';
import { parseCart, readCart, writeCart, CART_VERSION } from '../../src/lib/cartStorage.js';
import { dateKeyInBusinessZone, isPastBusinessDate } from '../../src/lib/businessTime.js';

const productId = '11111111-1111-4111-8111-111111111111';
const line = { item_type: 'bouquet', bouquet_id: productId, name: 'Synthetic bouquet', price: 100, quantity: 1, cartId: 'same' };
const pending = { body: { action: 'checkout', session_id: productId, request_uuid: productId, session_token: 's'.repeat(64), quote_token: 'q'.repeat(64), order: { customer_name: 'Synthetic customer', contact_number: 'test-number', preferred_date: '2000-01-01' } } };

function withStorage(name, implementation, run) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { configurable: true, value: implementation });
  try { run(); } finally {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
}

test('malformed and future-version carts cannot crash or inject invalid quantities', () => {
  for (const value of ['{', 'null', '42', '{"version":999,"items":[]}', 'x'.repeat(262145)]) assert.deepEqual(parseCart(value), []);
  for (const quantity of [0, -1, 1.5, 51, '2', null]) assert.deepEqual(parseCart(JSON.stringify([{ ...line, quantity }])), []);
  assert.deepEqual(parseCart(JSON.stringify([{ ...line, bouquet_id: 'bad' }])), []);
});

test('legacy carts retain selections but discard reservation data and duplicate identities', () => {
  const result = parseCart(JSON.stringify([{ ...line, reservation_token: 'legacy-token' }, line]));
  assert.equal(result.length, 2);
  assert.equal(result[0].bouquet_id, productId);
  assert.equal(result[0].reservation_token, undefined);
  assert.notEqual(result[0].cartId, result[1].cartId);
  assert.equal(parseCart(JSON.stringify({ version: CART_VERSION, items: [line] })).length, 1);
});

test('blocked cart and checkout storage reads and quota failures fail safely', () => {
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('quota'); }, removeItem() { throw new Error('blocked'); } };
  withStorage('localStorage', blocked, () => { assert.deepEqual(readCart(), []); assert.equal(writeCart([line]), false); });
  withStorage('sessionStorage', blocked, () => { assert.equal(readPendingCheckout(), null); assert.equal(writePendingCheckout(pending), false); assert.doesNotThrow(clearPendingCheckout); });
});

test('recovery preserves the exact request including old dates for idempotent replay', () => {
  const data = new Map();
  withStorage('sessionStorage', { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) }, () => {
    assert.equal(writePendingCheckout(pending), true);
    assert.deepEqual(readPendingCheckout(), pending);
    assert.equal(writePendingCheckout({ body: { ...pending.body, request_uuid: 'invalid' } }), false);
    clearPendingCheckout();
    assert.equal(readPendingCheckout(), null);
  });
});

test('business dates use Manila across the UTC day boundary', () => {
  assert.equal(dateKeyInBusinessZone(new Date('2026-10-07T16:00:00Z')), '2026-10-08');
  assert.equal(isPastBusinessDate('2000-01-01'), true);
  assert.equal(isPastBusinessDate('2099-01-01'), false);
});

test('checkout request identifiers are RFC 4122 UUIDs', () => {
  assert.match(newRequestUuid(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
});

test('production builds reject missing Turnstile and server keys', () => {
  const base = { VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_ANON_KEY: 'eyJhbGciOiJub25lIn0.eyJyb2xlIjoiYW5vbiJ9.test' };
  assert.throws(() => validatePublicEnv(base, { production: true }), /TURNSTILE/);
  assert.throws(() => validatePublicEnv({ ...base, VITE_TURNSTILE_SITE_KEY: 'site', VITE_SUPABASE_ANON_KEY: 'sb_secret_xxxxxxxxxxxxxxxxxxxxx' }, { production: true }), /public|secret/i);
  assert.doesNotThrow(() => validatePublicEnv({ ...base, VITE_TURNSTILE_SITE_KEY: 'site' }, { production: true }));
});

