import QRCode from 'qrcode';
import { writeFile, mkdir } from 'node:fs/promises';
import { DEFAULT_SITE_URL } from '../src/lib/siteUrl.js';

await mkdir('public', { recursive: true });
const options = { margin: 4, errorCorrectionLevel: 'M', color: { dark: '#252025', light: '#ffffff' } };
await QRCode.toFile('public/astraea-website-qr.png', DEFAULT_SITE_URL, { ...options, width: 1200 });
await writeFile('public/astraea-website-qr.svg', await QRCode.toString(DEFAULT_SITE_URL, { ...options, type: 'svg' }));
console.log(`Generated print-ready QR files for ${DEFAULT_SITE_URL}`);
