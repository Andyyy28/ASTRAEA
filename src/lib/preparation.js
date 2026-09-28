// Provisional workshop estimates, not a promise of availability or delivery.
// Keep the formula in sync with estimate_preparation_minutes in the migration.
const count = (value) => Math.max(0, Number(value) || 0);
export function estimateItem(item) {
  const d = item.custom_details || item;
  const quantity = Math.max(1, count(item.quantity));
  if (item.item_type !== 'custom') return { minutes: 15 * quantity, complexity: 'Ready-made' };
  const flowers = d.flowers || [];
  const stems = flowers.reduce((sum, f) => sum + count(f.quantity), 0);
  const fillers = (d.fillers || []).reduce((sum, f) => sum + count(f.quantity), 0);
  const addons = Object.values(d.addons || {}).filter(v => v === true).length;
  const size = typeof d.size === 'object' ? (d.size.key || d.size.id) : d.size;
  const sizeMinutes = { medium: 15, large: 30 }[String(size).toLowerCase()] || 0;
  const raw = 20 + stems * 8 + flowers.length * 5 + fillers * 3 + addons * 10 + sizeMinutes
    + (d.wrapper ? 10 : 0) + (d.instructions?.trim() ? 30 : 0);
  const minutes = Math.ceil(raw / 15) * 15;
  return { minutes: minutes * quantity, complexity: minutes <= 90 ? 'Simple' : minutes <= 180 ? 'Detailed' : 'Intricate' };
}
export const estimateOrder = (items) => items.reduce((sum, item) => sum + estimateItem(item).minutes, 0);
export const durationLabel = (minutes) => `${Math.floor(minutes / 60) ? `${Math.floor(minutes / 60)} hr ` : ''}${minutes % 60 ? `${minutes % 60} min` : ''}`.trim();
export const shopDate = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
export const shopDateTime = (date) => date ? new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date)) : 'Awaiting staff confirmation';
export function scheduleError(date, time, minutes, now = new Date()) {
  if (!date || !time) return 'Choose a requested date and time.';
  const requested = new Date(`${date}T${time}:00+08:00`);
  if (!Number.isFinite(requested.getTime())) return 'Choose a valid date and time.';
  if (requested.getTime() < now.getTime() + minutes * 60000) return `Allow at least ${durationLabel(minutes)} for preparation. Choose a later time.`;
  return '';
}
