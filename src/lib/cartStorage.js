export const CART_KEY = 'astraea_cart';
export const CART_VERSION = 2;
export const MAX_CART_ITEMS = 50;
export const MAX_ITEM_QUANTITY = 50;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value, max) => typeof value === 'string' ? value.slice(0, max) : '';
const image = value => typeof value === 'string' && /^(https?:\/\/|\/(?!\/))/.test(value) ? value : null;
const money = value => Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 10000000;
export const newCartId = () => globalThis.crypto?.randomUUID?.() || `cart-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const components = value => {
  if (!Array.isArray(value) || value.length > 20) return null;
  if (value.some(v => !record(v) || !uuid.test(v.id) || !Number.isInteger(v.quantity) || v.quantity < 1 || v.quantity > 100)) return null;
  return value.map(v => ({ id: v.id, name: text(v.name, 160), quantity: v.quantity, color: text(v.color, 80) || null }));
};

// Only keep selection/display fields. Legacy reservation tokens and bookkeeping
// must not survive cutover. All prices remain advisory until a new server quote.
export function normalizeCartItem(item) {
  if (!record(item) || !['bouquet', 'custom', 'other_product'].includes(item.item_type)) return null;
  if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_ITEM_QUANTITY) return null;
  const price = item.price ?? (Number(item.subtotal) / item.quantity);
  if (!money(price) || typeof item.name !== 'string') return null;
  const result = { item_type: item.item_type, name: text(item.name, 160), price: Number(price), quantity: item.quantity,
    cartId: text(item.cartId, 100) || newCartId(), image: image(item.image), message_card: text(item.message_card, 500) };
  if (item.item_type === 'bouquet') {
    if (!uuid.test(item.bouquet_id)) return null;
    result.bouquet_id = item.bouquet_id;
  } else if (item.item_type === 'other_product') {
    if (!uuid.test(item.other_product_id)) return null;
    result.other_product_id = item.other_product_id;
  } else {
    const d = item.custom_details;
    if (!record(d) || !record(d.size) || !['small', 'medium', 'large'].includes(d.size.key || d.size.id)) return null;
    const flowers = components(d.flowers), fillers = components(d.fillers || []);
    if (!flowers?.length || !fillers || (d.wrapper && (!record(d.wrapper) || !uuid.test(d.wrapper.id)))) return null;
    if (d.addons && (!record(d.addons) || Object.keys(d.addons).length > 20 || Object.entries(d.addons).some(([k, v]) => !/^[a-z0-9_-]{1,80}$/i.test(k) || typeof v !== 'boolean'))) return null;
    result.custom_details = {
      size: { key: d.size.key || d.size.id, id: d.size.key || d.size.id, name: text(d.size.name, 160), stems: text(d.size.stems, 80), basePrice: money(d.size.basePrice) ? Number(d.size.basePrice) : 0 },
      flowers, fillers, wrapper: d.wrapper ? { id: d.wrapper.id, material: text(d.wrapper.material, 160), color: text(d.wrapper.color, 80) } : null,
      addons: d.addons || {}, addonDetails: Array.isArray(d.addonDetails) ? d.addonDetails.filter(v => record(v) && typeof v.key === 'string').slice(0, 20).map(v => ({ key: text(v.key, 80), name: text(v.name, 160), price: money(v.price) ? Number(v.price) : 0 })) : [],
      message: text(d.message, 500), instructions: text(d.instructions, 1000)
    };
  }
  return result;
}

export function parseCart(raw) {
  try {
    if (typeof raw !== 'string' || raw.length > 256 * 1024) return [];
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed) ? parsed : parsed?.version === CART_VERSION ? parsed.items : [];
    if (!Array.isArray(items)) return [];
    const ids = new Set();
    return items.slice(0, MAX_CART_ITEMS).map(normalizeCartItem).filter(Boolean).map(item => {
      if (ids.has(item.cartId)) item.cartId = newCartId();
      ids.add(item.cartId);
      return item;
    });
  } catch { return []; }
}

export function readCart() {
  try { return parseCart(globalThis.localStorage.getItem(CART_KEY)); } catch { return []; }
}

export function writeCart(items) {
  try { globalThis.localStorage.setItem(CART_KEY, JSON.stringify({ version: CART_VERSION, items })); return true; } catch { return false; }
}
