import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanupCatalogImages } from '../../scripts/cleanupCatalogImages.js';

const name = '11111111-1111-4111-8111-111111111111.png';
const project = 'https://synthetic.supabase.co';
const url = `${project}/storage/v1/object/public/bouquets/catalog/${name}`;
function fixture({ reference = null, fail = false, lateReference = false } = {}) {
  let scans = 0; const removals = [];
  return {
    removals,
    client: {
      from(table) {
        if (table === 'bouquets') scans++;
        return { select: () => ({ order: () => ({ range: async () => ({ data: table === 'order_items' ? [{ snapshot: { image: reference || (lateReference && scans > 1 ? url : null) } }] : [], error: fail && table === 'checkout_sessions' ? { message: 'timeout' } : null }) }) }) };
      },
      storage: { from: bucket => ({
        list: async () => ({ data: bucket === 'bouquets' ? [{ id: 'object', name, created_at: '2000-01-01T00:00:00Z' }, { id: 'legacy', name: 'legacy.png', created_at: '2000-01-01T00:00:00Z' }] : [], error: null }),
        remove: async paths => { removals.push([bucket, paths]); return { error: null }; },
      }) },
    },
  };
}

test('cleanup preserves images referenced by historical order snapshots', async () => {
  const f = fixture({ reference: url });
  assert.deepEqual(await cleanupCatalogImages(f.client, project, { apply: true }), []);
  assert.equal(f.removals.length, 0);
});
test('cleanup defaults to dry-run and never includes unmanaged legacy objects', async () => {
  const f = fixture();
  assert.equal((await cleanupCatalogImages(f.client, project)).length, 1);
  assert.equal(f.removals.length, 0);
});
test('failed reference reads prevent all deletion', async () => {
  const f = fixture({ fail: true });
  await assert.rejects(cleanupCatalogImages(f.client, project, { apply: true }), /Reference scan failed/);
  assert.equal(f.removals.length, 0);
});
test('cleanup rescans references before deleting candidates', async () => {
  const f = fixture({ lateReference: true });
  await cleanupCatalogImages(f.client, project, { apply: true });
  assert.equal(f.removals.length, 0);
});
