const STORAGE_KEY = 'astraea_checkout_pending_v1';

function storage() {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

export function newRequestUuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (!globalThis.crypto?.getRandomValues) throw new Error('Secure checkout requests are unavailable in this browser.');
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function readPendingCheckout() {
  try {
    const value = storage()?.getItem(STORAGE_KEY);
    if (!value || value.length > 32768) return null;
    const parsed = JSON.parse(value);
    if (!validPendingCheckout(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writePendingCheckout(value) {
  if (!validPendingCheckout(value)) return false;
  const target = storage();
  if (!target) return false;
  try {
    const serialized = JSON.stringify(value);
    target.setItem(STORAGE_KEY, serialized);
    return target.getItem(STORAGE_KEY) === serialized;
  } catch {
    return false;
  }
}

function validPendingCheckout(value) {
  const body = value?.body;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return body?.action === 'checkout' && uuid.test(body.request_uuid) && uuid.test(body.session_id)
    && ['session_token', 'quote_token'].every(key => typeof body[key] === 'string' && body[key].length >= 32 && body[key].length <= 160)
    && body.order && typeof body.order === 'object' && !Array.isArray(body.order)
    && typeof body.order.customer_name === 'string' && typeof body.order.contact_number === 'string';
}

export function clearPendingCheckout() {
  try { storage()?.removeItem(STORAGE_KEY); } catch { /* storage may be disabled */ }
}

