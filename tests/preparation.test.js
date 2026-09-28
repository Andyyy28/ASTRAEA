import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateItem, estimateOrder, scheduleError, shopDate } from '../src/lib/preparation.js';
import { publicSiteUrl, DEFAULT_SITE_URL } from '../src/lib/siteUrl.js';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';

test('complexity, quantities and instructions increase preparation', () => {
  const simple = { item_type: 'custom', quantity: 1, flowers: [{ quantity: 1 }], size: 'small' };
  assert.equal(estimateItem(simple).minutes, 45);
  const detailed = { ...simple, size: 'large', flowers: [{ quantity: 12 }, { quantity: 3 }], fillers: [{ quantity: 2 }], addons: { ribbon: true, card: false }, wrapper: { id: 'x' }, instructions: 'Special shape' };
  assert.equal(estimateItem(detailed).minutes, 240);
  assert.equal(estimateItem(detailed).complexity, 'Intricate');
  assert.equal(estimateOrder([{ ...detailed, quantity: 2 }, { item_type: 'bouquet', quantity: 2 }]), 510);
  assert.equal(estimateItem({ ...simple, custom_details: { size: { key: 'small' }, flowers: [{ quantity: 1 }] } }).minutes, 45);
});
test('requested time validation uses Philippine time, including midnight', () => {
  const now = new Date('2026-09-28T15:30:00Z');
  assert.equal(shopDate(now), '2026-09-28');
  assert.ok(scheduleError('2026-09-28', '23:59', 45, now));
  assert.equal(scheduleError('2026-09-29', '00:15', 45, now), '');
  assert.ok(scheduleError('', '', 45, now));
  assert.ok(scheduleError('invalid', '09:00', 45, now));
});
test('QR target strips admin routes and rejects unsafe or local addresses', () => {
  assert.equal(publicSiteUrl('https://astraeacollection.vercel.app/admin?token=x'), DEFAULT_SITE_URL);
  for (const input of ['javascript:alert(1)', 'http://localhost:5173', 'http://127.0.0.1', 'https://user:pass@example.com']) assert.equal(publicSiteUrl(input), null);
});
test('generated printable QR decodes to the public storefront', async () => {
  const png = PNG.sync.read(await QRCode.toBuffer(DEFAULT_SITE_URL, { width: 768, margin: 4, errorCorrectionLevel: 'M' }));
  const result = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  assert.equal(result?.data, DEFAULT_SITE_URL);
});
