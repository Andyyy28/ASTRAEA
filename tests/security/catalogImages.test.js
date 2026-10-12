import test from 'node:test';
import assert from 'node:assert/strict';
import { uploadCatalogImages } from '../../src/lib/catalogImages.js';

const photo = name => ({ name, type: 'image/png', size: 100 });
function storageMock(failAt = -1) {
  const uploads = [];
  const supabase = { storage: { from(bucket) {
    assert.equal(bucket, 'bouquets');
    return {
      async upload(path, file, options) {
        uploads.push({ path, file, options });
        return { error: uploads.length === failAt ? new Error('Upload failed') : null };
      },
      getPublicUrl(path) { return { data: { publicUrl: 'https://example.test/' + path } }; },
    };
  } } };
  return { supabase, uploads };
}

test('multiple bouquet uploads preserve existing images and displayed order', async () => {
  const { supabase, uploads } = storageMock();
  const urls = await uploadCatalogImages(supabase, 'bouquets', [
    { existingUrl: 'https://example.test/cover.png' }, { file: photo('second.png') },
    { existingUrl: 'https://example.test/third.png' }, { file: photo('fourth.png') },
  ]);
  assert.equal(urls.length, 4);
  assert.equal(urls[0], 'https://example.test/cover.png');
  assert.equal(urls[2], 'https://example.test/third.png');
  assert.deepEqual(uploads.map(item => item.file.name), ['second.png', 'fourth.png']);
  assert.equal(urls[1], 'https://example.test/' + uploads[0].path);
  assert.equal(urls[3], 'https://example.test/' + uploads[1].path);
  assert.notEqual(urls[1], urls[3]);
  assert.ok(uploads.every(item => item.options.upsert === false));
});

test('invalid photos fail before any file is uploaded', async () => {
  const { supabase, uploads } = storageMock();
  await assert.rejects(uploadCatalogImages(supabase, 'bouquets', [
    { file: photo('valid.png') }, { file: { type: 'image/svg+xml', size: 100 } },
  ]), /JPEG, PNG, or WebP/);
  assert.equal(uploads.length, 0);
});

test('failed upload rejects the image list instead of allowing a partial save', async () => {
  const { supabase } = storageMock(2);
  await assert.rejects(uploadCatalogImages(supabase, 'bouquets', [
    { file: photo('first.png') }, { file: photo('second.png') },
  ]), /Upload failed/);
});

test('removing all photos saves an empty list without uploads', async () => {
  const { supabase, uploads } = storageMock();
  assert.deepEqual(await uploadCatalogImages(supabase, 'bouquets', []), []);
  assert.equal(uploads.length, 0);
});
