import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdminAuth } from '../../src/lib/adminAuth.js';

const session = { user: { id: 'verified-user' }, access_token: 'session-token', expires_at: Math.floor(Date.now() / 1000) + 3600 };
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
async function until(predicate) {
  const deadline = Date.now() + 500;
  while (!predicate()) {
    assert.ok(Date.now() < deadline, 'state transition did not complete');
    await new Promise(resolve => setTimeout(resolve, 2));
  }
}
function fixture({ restored = null, rpc = async () => ({ data: true, error: null }), signIn } = {}) {
  let callback;
  let inCallback = false;
  let calls = 0;
  const client = {
    rpc() { assert.equal(inCallback, false, 'RPC must not execute inside auth callback'); calls++; return rpc(); },
    auth: {
      getSession: async () => ({ data: { session: restored }, error: null }),
      onAuthStateChange(fn) { callback = fn; return { data: { subscription: { unsubscribe() { callback = undefined; } } } }; },
      signInWithPassword: signIn || (async () => ({ data: { session, user: session.user }, error: null })),
      signUp() { assert.fail('Login must never create an account'); },
      async signOut() { callback?.('SIGNED_OUT', null); return { error: null }; },
    },
  };
  const controller = createAdminAuth(client, { timeoutMs: 25 });
  const emit = value => {
    inCallback = true;
    try { assert.equal(callback('SIGNED_IN', value), undefined); }
    finally { inCallback = false; }
  };
  return { controller, emit, calls: () => calls };
}

test('only a true admin result allows restored sessions', async t => {
  for (const result of [false, null, 'true', { data: true }]) {
    await t.test(String(result), async () => {
      const f = fixture({ restored: session, rpc: async () => ({ data: result, error: null }) });
      f.controller.start();
      try { await until(() => !f.controller.getState().loading); assert.equal(f.controller.getState().isAdmin, false); assert.equal(f.controller.getState().user, null); }
      finally { f.controller.stop(); }
    });
  }
  const f = fixture({ restored: session });
  f.controller.start();
  try { await until(() => f.controller.getState().isAdmin); assert.equal(f.controller.getState().user.id, session.user.id); }
  finally { f.controller.stop(); }
});

test('RPC failures, missing RPCs, exceptions and timeouts deny login', async t => {
  for (const rpc of [
    async () => ({ data: null, error: { code: 'PGRST202' } }),
    async () => ({ data: true, error: { code: '42501' } }),
    async () => { throw new Error('backend unavailable'); },
    () => new Promise(() => {}),
  ]) {
    await t.test('failure remains denied', async () => {
      const f = fixture({ rpc }); f.controller.start();
      try { const result = await f.controller.login('user@example.test', 'supplied-password'); assert.ok(result.error); assert.equal(f.controller.getState().isAdmin, false); }
      finally { f.controller.stop(); }
    });
  }
});

test('failed password login never invokes signup or accepts existing session', async () => {
  const f = fixture({ signIn: async () => ({ data: null, error: { message: 'raw provider details' } }) });
  f.controller.start();
  try {
    assert.ok((await f.controller.login('user@example.test', 'wrong')).error);
    f.emit(session);
    assert.equal(f.controller.getState().isAdmin, false);
    assert.equal(f.calls(), 0);
  } finally { f.controller.stop(); }
});

test('auth callback defers RPC and invalidates late role checks after logout', async () => {
  const pending = deferred(); const f = fixture({ rpc: () => pending.promise });
  f.controller.start();
  try {
    f.emit(session); await until(() => f.calls() === 1);
    await f.controller.logout(); pending.resolve({ data: true, error: null });
    await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(f.controller.getState().isAdmin, false);
    f.emit(session); assert.equal(f.controller.getState().isAdmin, false);
  } finally { f.controller.stop(); }
});

test('expired sessions and missing configuration never verify roles', async () => {
  const f = fixture({ restored: { ...session, expires_at: 1 } }); f.controller.start();
  try { await until(() => !f.controller.getState().loading); assert.equal(f.calls(), 0); assert.equal(f.controller.getState().isAdmin, false); }
  finally { f.controller.stop(); }
  const controller = createAdminAuth({}, { configured: false }); controller.start();
  assert.equal(controller.getState().isAdmin, false); assert.ok((await controller.login('x', 'y')).error); controller.stop();
});

test('an older verification cannot authorize a newer session', async () => {
  const pending = deferred(); let count = 0;
  const f = fixture({ rpc: () => ++count === 1 ? pending.promise : Promise.resolve({ data: false, error: null }) });
  f.controller.start();
  try {
    f.emit(session); await until(() => count === 1);
    f.emit({ ...session, user: { id: 'ordinary-user' } }); await until(() => count === 2 && !f.controller.getState().loading);
    pending.resolve({ data: true, error: null }); await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(f.controller.getState().isAdmin, false);
  } finally { f.controller.stop(); }
});

test('stopping and restarting ignores old session loads', async () => {
  const slow = deferred(); let load = 0;
  const client = {
    auth: { getSession: () => ++load === 1 ? slow.promise : Promise.resolve({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
    rpc() { assert.fail('Stale session cannot be verified'); },
  };
  const c = createAdminAuth(client, { timeoutMs: 25 }); c.start(); c.stop(); c.start();
  await until(() => !c.getState().loading); slow.resolve({ data: { session } }); await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(c.getState().isAdmin, false); c.stop();
});
