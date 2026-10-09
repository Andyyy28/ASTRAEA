import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const MAX_BYTES = 5 * 1024 * 1024;
const ORDER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LEGACY_PATH = new RegExp(`^payment-proofs/([^/]+\\.(?:jpg|jpeg|png|webp))$`, 'i');
const CHECKPOINT_DEFAULT = path.resolve('.local/phase2-proof-migration.json');

export function detectImageType(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value)) return 'image/png';
  if (bytes.length >= 12 && Buffer.from(bytes.slice(0, 4)).toString('ascii') === 'RIFF' && Buffer.from(bytes.slice(8, 12)).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}

export function parseLegacyReference(reference, projectUrl) {
  if (typeof reference !== 'string') return null;
  let url;
  try { url = new URL(reference); } catch { return null; }
  const project = new URL(projectUrl);
  const prefix = '/storage/v1/object/public/bouquets/';
  if (url.origin !== project.origin || !url.pathname.startsWith(prefix) || url.search || url.hash || url.username || url.password) return null;
  let file;
  try { file = decodeURIComponent(url.pathname.slice(prefix.length)); } catch { return null; }
  const match = LEGACY_PATH.exec(file);
  if (!match || /[\\%\0]/.test(file) || match[1] === '.' || match[1] === '..') return null;
  return { bucket: 'bouquets', path: file };
}

async function hashBytes(bytes) { return createHash('sha256').update(bytes).digest('hex'); }

async function loadCheckpoint(file) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return { completed: {} }; }
}

async function saveCheckpoint(file, checkpoint) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(checkpoint, null, 2)}\n`, 'utf8');
  await fs.rename(temporary, file);
}

function optionsFromArgs(args, env) {
  const apply = args.includes('--apply');
  const deleteVerified = args.includes('--delete-verified');
  if (deleteVerified && !apply) throw new Error('--delete-verified requires --apply.');
  if (deleteVerified && args.includes('--confirm-delete') === false) throw new Error('--delete-verified requires --confirm-delete.');
  const checkpointIndex = args.indexOf('--checkpoint');
  const checkpoint = checkpointIndex >= 0 ? args[checkpointIndex + 1] : CHECKPOINT_DEFAULT;
  if (!checkpoint || checkpoint.startsWith('-')) throw new Error('--checkpoint requires a file path.');
  const projectUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  if (!projectUrl || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  const parsed = new URL(projectUrl);
  if (parsed.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(parsed.hostname)) throw new Error('Use an HTTPS Supabase URL, or a local development URL.');
  return { apply, deleteVerified, checkpoint: path.resolve(checkpoint), projectUrl: parsed.origin };
}

export async function migrateProofs(client, options, log = console) {
  const checkpoint = await loadCheckpoint(options.checkpoint);
  checkpoint.completed ||= {};
  let offset = 0;
  let scanned = 0;
  let migrated = 0;
  let skipped = 0;
  while (true) {
    const { data: orders, error } = await client.from('orders').select('id,payment_proof_url').not('payment_proof_url', 'is', null).order('id').range(offset, offset + 99);
    if (error) throw new Error(`Could not list orders: ${error.message}`);
    if (!orders?.length) break;
    offset += orders.length;
    for (const order of orders) {
      scanned++;
      const legacy = parseLegacyReference(order.payment_proof_url, options.projectUrl);
      if (!legacy || !ORDER_ID.test(order.id || '')) { skipped++; continue; }
      if (checkpoint.completed[order.id]?.status === 'migrated') { skipped++; continue; }
      if (!options.apply) { log.log(`would migrate one proof (order ${order.id})`); continue; }

      const { data: file, error: downloadError } = await client.storage.from(legacy.bucket).download(legacy.path);
      if (downloadError || !file) throw new Error(`Could not download legacy proof for order ${order.id}.`);
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (bytes.length < 1 || bytes.length > MAX_BYTES) throw new Error(`Legacy proof for order ${order.id} exceeds 5 MiB.`);
      const contentType = detectImageType(bytes);
      if (!contentType) throw new Error(`Legacy proof for order ${order.id} has an unsupported signature.`);
      const extension = contentType === 'image/jpeg' ? 'jpg' : contentType.slice(6);
      const destination = `${order.id}/${randomUUID()}.${extension}`;
      const { error: uploadError } = await client.storage.from('payment-proofs').upload(destination, new Blob([bytes], { type: contentType }), { contentType, upsert: false });
      if (uploadError) throw new Error(`Could not copy proof for order ${order.id}.`);
      const { data: copied, error: verifyError } = await client.storage.from('payment-proofs').download(destination);
      const copiedBytes = copied ? new Uint8Array(await copied.arrayBuffer()) : null;
      if (verifyError || !copiedBytes || copiedBytes.length !== bytes.length || await hashBytes(copiedBytes) !== await hashBytes(bytes)) {
        await client.storage.from('payment-proofs').remove([destination]);
        throw new Error(`Copied proof verification failed for order ${order.id}.`);
      }
      const newReference = `payment-proofs/${destination}`;
      const { error: updateError } = await client.from('orders').update({ payment_proof_url: newReference }).eq('id', order.id);
      if (updateError) {
        await client.storage.from('payment-proofs').remove([destination]);
        throw new Error(`Could not update proof reference for order ${order.id}.`);
      }
      if (options.deleteVerified) {
        const { error: deleteError } = await client.storage.from(legacy.bucket).remove([legacy.path]);
        if (deleteError) log.warn(`Copied order ${order.id}, but could not remove its public original.`);
      }
      checkpoint.completed[order.id] = { status: 'migrated', reference: newReference, migratedAt: new Date().toISOString() };
      await saveCheckpoint(options.checkpoint, checkpoint);
      migrated++;
    }
  }
  return { scanned, migrated, skipped, dryRun: !options.apply };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const options = optionsFromArgs(process.argv.slice(2), process.env);
  const client = createClient(options.projectUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const result = await migrateProofs(client, options);
  console.log(JSON.stringify(result));
}
