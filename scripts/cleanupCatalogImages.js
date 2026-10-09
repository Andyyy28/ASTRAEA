import { createClient } from '@supabase/supabase-js';
import { pathToFileURL } from 'node:url';

const sources = [['bouquets', 'images'], ['other_products', 'images'], ['flowers', 'image_url'], ['fillers', 'image_url'], ['wrappers', 'image_url'], ['bouquet_addons', 'image_url'], ['order_items', '*'], ['checkout_sessions', 'quote_snapshot']];
const buckets = ['bouquets', 'other-products', 'addons', 'images'];
const pageSize = 200;
const managedName = /^[0-9a-f-]{36}\.(jpg|png|webp)$/i;

export function objectReference(value, projectUrl) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value), project = new URL(projectUrl);
    if (url.origin !== project.origin) return null;
    const match = url.pathname.match(/^\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
    return match && buckets.includes(match[1]) ? `${match[1]}/${decodeURIComponent(match[2])}` : null;
  } catch { return null; }
}

async function references(client, projectUrl) {
  const found = new Set();
  const visit = value => {
    const ref = objectReference(value, projectUrl);
    if (ref) found.add(ref);
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') Object.values(value).forEach(visit);
  };
  for (const [table, columns] of sources) {
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await client.from(table).select(columns).order('id').range(offset, offset + pageSize - 1);
      if (error || !Array.isArray(data)) throw new Error(`Reference scan failed for ${table}; no cleanup is safe.`);
      data.forEach(visit);
      if (data.length < pageSize) break;
    }
  }
  return found;
}

export async function cleanupCatalogImages(client, projectUrl, { apply = false, now = Date.now() } = {}) {
  const referenced = await references(client, projectUrl);
  const candidates = [];
  // Limit deletion to new managed UUID paths. Legacy uploads/payment proofs are
  // deliberately excluded; their lifecycle belongs to the proof migration.
  for (const bucket of buckets) {
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await client.storage.from(bucket).list('catalog', { limit: pageSize, offset, sortBy: { column: 'name', order: 'asc' } });
      if (error || !Array.isArray(data)) throw new Error(`Storage scan failed for ${bucket}; cleanup stopped.`);
      for (const object of data) {
        const path = `catalog/${object.name}`;
        const timestamp = Math.max(Date.parse(object.created_at), Date.parse(object.updated_at || object.created_at));
        if (object.id && managedName.test(object.name) && Number.isFinite(timestamp) && timestamp < now - 86400000 && !referenced.has(`${bucket}/${path}`)) candidates.push({ bucket, path });
      }
      if (data.length < pageSize) break;
    }
  }
  if (apply) {
    // Operators must pause catalog editing and submissions during apply to
    // eliminate reference-write races. Re-scan immediately before deleting.
    const latest = await references(client, projectUrl);
    for (const candidate of candidates) {
      if (latest.has(`${candidate.bucket}/${candidate.path}`)) continue;
      const { error } = await client.storage.from(candidate.bucket).remove([candidate.path]);
      if (error) throw new Error(`Cleanup failed for ${candidate.bucket}; stopped.`);
    }
  }
  return candidates;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  const apply = process.argv.includes('--apply');
  if (apply && (!process.argv.includes('--maintenance-confirmed') || !process.argv.includes(`--project=${new URL(url).host}`))) throw new Error('Apply requires --maintenance-confirmed and --project=<exact project host>. Pause submissions and catalog editing first.');
  const client = createClient(url, key, { auth: { persistSession: false } });
  const result = await cleanupCatalogImages(client, url, { apply });
  console.log(JSON.stringify({ mode: apply ? 'applied' : 'dry-run', candidates: result }, null, 2));
}
