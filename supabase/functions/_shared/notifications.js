import { HttpError, bearerToken, errorResponse, jsonResponse, secureEquals } from './http.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const escape = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const field = (label, value) => `${label}: ${escape(String(value ?? '').slice(0, 250))}`;
const money = value => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value));

export function formatOrderNotification(order, items) {
  const lines = [
    '<b>New order</b>', field('Reference', order.reference_number),
    field('Customer', order.customer_name), field('Contact', order.contact_number),
    field('Payment', order.payment_method), field('Method', order.delivery_method),
    field('Date/time', [order.preferred_date, order.preferred_time].filter(Boolean).join(' ')),
    ...(order.delivery_method === 'delivery' ? [field('Address', order.delivery_address)] : []),
    field('Total', money(order.total_amount)), '', '<b>Items</b>',
  ];
  // Bound the message so untrusted free text cannot exceed Telegram's limits.
  for (const item of items.slice(0, 5)) {
    const name = item.bouquets?.name || item.other_products?.name || 'Custom bouquet';
    lines.push(field(`${item.quantity}x`, name));
    if (item.size) lines.push(field('Size', item.size));
    for (const key of ['flowers', 'fillers']) {
      if (Array.isArray(item[key])) {
        lines.push(field(key, item[key].map(component =>
          `${component.quantity || 1}x ${component.name || 'Component'}${component.color ? ` (${component.color})` : ''}`
        ).join(', ')));
      }
    }
    if (item.wrapper) lines.push(field('Wrapper', [item.wrapper.material, item.wrapper.color].filter(Boolean).join(' / ')));
    if (item.addons && !Array.isArray(item.addons) && typeof item.addons === 'object') {
      lines.push(field('Addons', Object.entries(item.addons).filter(([, enabled]) => enabled === true).map(([key]) => key).join(', ')));
    }
    if (item.message_card) lines.push(field('Card', item.message_card));
    if (item.instructions) lines.push(field('Instructions', item.instructions));
  }
  if (order.special_notes) lines.push(field('Notes', order.special_notes));
  // Keep escaped entities and tags intact by dropping complete lines only.
  while (lines.join('\n').length > 3800) lines.pop();
  lines.push('Full details are available in the admin order record.');
  return lines.join('\n');
}

export function formatReviewNotification(review) {
  return ['<b>New review</b>', field('Name', review.name), field('Rating', review.rating), field('Message', review.message)].join('\n');
}

async function loadMessage(client, event) {
  if (!UUID.test(event.entity_id)) throw new HttpError(503, 'invalid_event');
  if (event.event_type === 'order.created') {
    const { data: order, error } = await client.from('orders').select('*').eq('id', event.entity_id).single();
    if (error || !order) throw new HttpError(503, 'record_unavailable');
    const { data: items, error: itemError } = await client.from('order_items')
      .select('*, bouquets(name), other_products(name)').eq('order_id', event.entity_id).order('id');
    if (itemError || !Array.isArray(items)) throw new HttpError(503, 'record_unavailable');
    return formatOrderNotification(order, items);
  }
  if (event.event_type === 'review.created') {
    const { data, error } = await client.from('reviews').select('name,rating,message').eq('id', event.entity_id).single();
    if (error || !data) throw new HttpError(503, 'record_unavailable');
    return formatReviewNotification(data);
  }
  throw new HttpError(503, 'invalid_event');
}

async function sendTelegram(fetchImpl, token, chatId, text) {
  try {
    const response = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
      signal: AbortSignal.timeout(5000),
    });
    const body = await response.json();
    if (!response.ok || body.ok !== true) {
      const error = new HttpError(503, 'telegram_rejected');
      const delay = Number(body.parameters?.retry_after);
      if (Number.isFinite(delay)) error.retryAfter = Math.min(86400, Math.max(60, Math.ceil(delay)));
      throw error;
    }
  } catch (error) {
    // Never return/log a fetch error: it may contain the credential-bearing URL.
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, 'telegram_unavailable');
  }
}

export function createNotificationHandler({ getEnv, createClient, fetchImpl = fetch }) {
  return async request => {
    try {
      if (request.method !== 'POST') throw new HttpError(405, 'method_not_allowed');
      const secret = getEnv('NOTIFICATION_WORKER_SECRET');
      if (!secret || secret.length < 32) throw new HttpError(503, 'worker_not_configured');
      if (!await secureEquals(bearerToken(request), secret)) throw new HttpError(401, 'unauthorized');
      if (request.body) throw new HttpError(400, 'body_not_allowed');
      // No browser payload or entity ID is accepted; only the durable queue is used.
      const token = getEnv('TELEGRAM_BOT_TOKEN');
      const chatId = getEnv('TELEGRAM_CHAT_ID');
      if (!token || !chatId || !getEnv('SUPABASE_URL') || !getEnv('SUPABASE_SERVICE_ROLE_KEY')) throw new HttpError(503, 'worker_not_configured');
      const client = createClient();
      const { data: events, error } = await client.rpc('claim_notification_events', { p_limit: 5, p_lease_seconds: 120 });
      if (error || !Array.isArray(events) || events.length > 5) throw new HttpError(503, 'outbox_unavailable');
      let delivered = 0;
      let retrying = 0;
      for (const event of events) {
        if (!UUID.test(event.id) || !UUID.test(event.claim_token)) throw new HttpError(503, 'invalid_event');
        try {
          await sendTelegram(fetchImpl, token, chatId, await loadMessage(client, event));
          const { data: acknowledged, error: ackError } = await client.rpc('complete_notification_event', { p_id: event.id, p_claim_token: event.claim_token });
          if (ackError || acknowledged !== true) throw new HttpError(503, 'acknowledgement_failed');
          delivered++;
        } catch (failure) {
          const attempt = Math.min(6, Math.max(0, Number(event.attempts) || 0));
          const { data: scheduled, error: retryError } = await client.rpc('retry_notification_event', {
            p_id: event.id, p_claim_token: event.claim_token,
            p_retry_after_seconds: failure.retryAfter || Math.min(3600, 60 * (2 ** attempt)),
            p_error_code: failure instanceof HttpError ? failure.code : 'processing_failed',
          });
          if (retryError || scheduled !== true) throw new HttpError(503, 'retry_unavailable');
          retrying++;
        }
      }
      return jsonResponse(200, { delivered, retrying });
    } catch (error) { return errorResponse(error); }
  };
}
