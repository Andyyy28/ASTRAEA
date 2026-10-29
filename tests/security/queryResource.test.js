import test from 'node:test';
import assert from 'node:assert/strict';
import { createQueryResource } from '../../src/lib/queryResource.js';

test('concurrent mounts and prefetch share one request, including empty results', async () => {
  let calls = 0;
  const resource = createQueryResource(async () => { calls++; return []; });
  const first = resource.load();
  assert.equal(resource.load(), first);
  await first;
  await resource.load();
  assert.equal(calls, 1);
  assert.deepEqual(resource.getSnapshot(), { data: [], loading: false, error: null });
});

test('expired data stays visible during refresh, then updates', async () => {
  let clock = 0;
  let finish;
  const resource = createQueryResource(() => new Promise(resolve => { finish = resolve; }), { now: () => clock, maxAge: 30 });
  const first = resource.load();
  await Promise.resolve();
  finish(['old']);
  await first;
  clock = 31;
  const refresh = resource.load();
  assert.deepEqual(resource.getSnapshot().data, ['old']);
  assert.equal(resource.getSnapshot().loading, false);
  await Promise.resolve();
  finish(['new']);
  await refresh;
  assert.deepEqual(resource.getSnapshot().data, ['new']);
});

test('failed requests stop loading and can be retried without caching the error', async () => {
  let calls = 0;
  const resource = createQueryResource(async () => {
    if (++calls === 1) throw new Error('offline');
    return ['recovered'];
  });
  await resource.load();
  assert.equal(resource.getSnapshot().loading, false);
  assert.equal(resource.getSnapshot().error.message, 'offline');
  await resource.load();
  assert.deepEqual(resource.getSnapshot().data, ['recovered']);
  assert.equal(resource.getSnapshot().error, null);
});

test('live events during initial load preserve the full list and latest stock', async () => {
  let finish;
  const resource = createQueryResource(() => new Promise(resolve => { finish = resolve; }));
  const request = resource.load();
  await Promise.resolve();
  resource.update(rows => rows.map(row => row.id === 1 ? { ...row, stock: 0 } : row));
  assert.equal(resource.getSnapshot().loading, true);
  finish([{ id: 1, stock: 5 }, { id: 2, stock: 10 }]);
  await request;
  assert.deepEqual(resource.getSnapshot().data, [{ id: 1, stock: 0 }, { id: 2, stock: 10 }]);
});

test('a refresh cannot undo realtime deletes or stock updates', async () => {
  let finish;
  const resource = createQueryResource(() => new Promise(resolve => { finish = resolve; }));
  let request = resource.load();
  await Promise.resolve();
  finish([{ id: 1, stock: 5 }, { id: 2, stock: 10 }]);
  await request;
  resource.invalidate();
  request = resource.load();
  await Promise.resolve();
  resource.update(rows => rows.filter(row => row.id !== 1).map(row => ({ ...row, stock: 0 })));
  finish([{ id: 1, stock: 5 }, { id: 2, stock: 10 }]);
  await request;
  assert.deepEqual(resource.getSnapshot().data, [{ id: 2, stock: 0 }]);
});

test('unsubscribed pages receive no more notifications', async () => {
  const resource = createQueryResource(async () => ['item']);
  let notifications = 0;
  const unsubscribe = resource.subscribe(() => notifications++);
  await resource.load();
  assert.equal(notifications, 2);
  unsubscribe();
  resource.update([]);
  assert.equal(notifications, 2);
});
