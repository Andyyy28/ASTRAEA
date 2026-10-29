import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveInventoryImageUrl } from '../../src/lib/inventoryImageUrls.js';

const manifest = JSON.parse(readFileSync(new URL('../../docs/inventory-flower-image-sources.json', import.meta.url), 'utf8'));

test('every reference flower uses an existing same-origin image under the production policy', () => {
  for (const image of manifest.images) {
    const resolved = resolveInventoryImageUrl(image.url);
    assert.equal(resolved, image.localPath);
    assert.match(resolved, /^\/images\/flowers\/[a-z0-9-]+\.(jpg|png|webp)$/);
    const bytes = readFileSync(new URL('../../public' + resolved, import.meta.url));
    const signature = bytes.subarray(0, 4).toString('hex');
    assert.ok(signature.startsWith('ffd8') || signature === '89504e47' || signature === '52494646', image.name);
  }
});

test('uploads, local assets and unsaved previews retain their original URLs', () => {
  for (const url of [null, '', '/images/fillers/fern.jpg', 'data:image/jpeg;base64,test', 'blob:https://example.com/preview', 'https://example.supabase.co/storage/v1/object/public/images/new.jpg', 'https://example.com/custom.jpg']) {
    assert.equal(resolveInventoryImageUrl(url), url);
  }
});
