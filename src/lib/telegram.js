/**
 * telegram.js
 * Sends Telegram notifications for new orders and reviews.
 * Uses a lightweight in-memory dedup set so the same payload
 * is never sent twice during a single browser session.
 */

const BOT_TOKEN = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
const CHAT_ID   = import.meta.env.VITE_TELEGRAM_CHAT_ID;

/** Keys already sent this session – prevents double-firing on StrictMode double-renders */
const _sent = new Set();

/**
 * Low-level helper: POST a message to the Telegram Bot API.
 * Silently swallows errors so a notification failure never
 * breaks the customer-facing flow.
 *
 * @param {string} text  – MarkdownV2-escaped message text
 */
async function _send(text) {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.warn('[Telegram] Missing VITE_TELEGRAM_BOT_TOKEN or VITE_TELEGRAM_CHAT_ID');
    return;
  }

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text,
          parse_mode: 'HTML',
        }),
      }
    );
    if (!res.ok) {
      const body = await res.text();
      console.error('[Telegram] API error:', res.status, body);
    }
  } catch (err) {
    console.error('[Telegram] Fetch error:', err);
  }
}

/** Safely escape HTML special characters for Telegram HTML parse_mode */
function esc(value) {
  if (value === null || value === undefined || String(value).trim() === '') return 'N/A';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Format a price number as PHP currency string.
 * @param {number} amount
 */
function formatPrice(amount) {
  if (typeof amount !== 'number' || isNaN(amount)) return 'N/A';
  return `₱${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

/**
 * Build a human-readable label for a single cart item.
 * Handles bouquet, custom bouquet, and other_product types.
 *
 * @param {object} item  – cart item object
 * @returns {string}
 */
function describeItem(item) {
  const name = item.name || 'Item';
  const qty  = item.quantity || 1;
  const subtotal = formatPrice((item.price || 0) * qty);

  let details = '';

  if (item.item_type === 'custom' && item.custom_details) {
    const d = item.custom_details;
    const parts = [];
    if (d.size?.label)  parts.push(`Size: ${d.size.label}`);
    if (d.flowers?.length) {
      const flowerList = d.flowers.map(f => f.name || f).join(', ');
      parts.push(`Flowers: ${flowerList}`);
    }
    if (d.fillers?.length) {
      const fillerList = d.fillers.map(f => f.name || f).join(', ');
      parts.push(`Fillers: ${fillerList}`);
    }
    if (d.wrapper?.name) parts.push(`Wrapper: ${d.wrapper.name}`);
    if (d.addons?.length) {
      const addonList = d.addons.map(a => a.name || a).join(', ');
      parts.push(`Add-ons: ${addonList}`);
    }
    if (d.message)      parts.push(`Message: "${d.message}"`);
    if (parts.length)   details = ` (${parts.join(' | ')})`;
  }

  if (item.message_card) {
    details += details ? ` | Card: "${item.message_card}"` : ` (Card: "${item.message_card}")`;
  }

  return `  • ${qty}× ${esc(name)}${details ? ` ${details}` : ''} — ${subtotal}`;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Send a "New Order!" Telegram notification.
 *
 * @param {{
 *   referenceNumber: string,
 *   customerName: string,
 *   contactNumber: string,
 *   deliveryMethod: 'pickup'|'delivery',
 *   paymentMethod: string,
 *   preferredDate: string,
 *   preferredTime: string,
 *   deliveryAddress: string,
 *   specialNotes: string,
 *   cartItems: object[],
 *   grandTotal: number,
 * }} order
 */
export async function sendOrderNotification(order) {
  const dedupKey = `order:${order.referenceNumber}`;
  if (_sent.has(dedupKey)) return;
  _sent.add(dedupKey);

  const itemLines = (order.cartItems || []).map(describeItem).join('\n');

  const delivery = order.deliveryMethod === 'delivery'
    ? `🚚 Delivery — ${esc(order.deliveryAddress)}`
    : '🏪 Store Pickup';

  const dateTime = [order.preferredDate, order.preferredTime].filter(Boolean).join(' @ ') || 'N/A';

  const text = [
    '🛒 <b>New Order!</b>',
    '',
    `👤 <b>Customer:</b> ${esc(order.customerName)}`,
    `📞 <b>Contact:</b> ${esc(order.contactNumber)}`,
    `🗓 <b>Date/Time:</b> ${esc(dateTime)}`,
    `📦 <b>Delivery:</b> ${delivery}`,
    `💳 <b>Payment:</b> ${esc(order.paymentMethod?.toUpperCase())}`,
    '',
    '<b>Items:</b>',
    itemLines || '  • (none)',
    '',
    `💰 <b>Total: ${formatPrice(order.grandTotal)}</b>`,
    order.specialNotes ? `\n📝 <i>Notes: ${esc(order.specialNotes)}</i>` : '',
    `\n🔖 <b>Ref #:</b> ${esc(order.referenceNumber)}`,
  ].filter(line => line !== null).join('\n');

  await _send(text);
}

/**
 * Send a "New Review!" Telegram notification.
 *
 * @param {{
 *   customerName: string,
 *   rating: number|null,
 *   message: string,
 * }} review
 */
export async function sendReviewNotification(review) {
  // Deduplicate by name + first 40 chars of message
  const dedupKey = `review:${review.customerName}:${String(review.message).slice(0, 40)}`;
  if (_sent.has(dedupKey)) return;
  _sent.add(dedupKey);

  const stars = review.rating
    ? '⭐'.repeat(Math.min(5, Math.max(1, Number(review.rating))))
    : null;

  const text = [
    '⭐ <b>New Review!</b>',
    '',
    `👤 <b>Customer:</b> ${esc(review.customerName)}`,
    stars ? `${stars} <b>Rating:</b> ${review.rating}/5` : `📊 <b>Rating:</b> N/A`,
    '',
    `💬 <b>Message:</b>\n<i>${esc(review.message)}</i>`,
  ].join('\n');

  await _send(text);
}
