export const BUSINESS_TIME_ZONE = 'Asia/Manila';

export const dateKeyInBusinessZone = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(date);
};

export const todayKeyInManila = () => dateKeyInBusinessZone(new Date());

export const isValidDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

export const isPastBusinessDate = (value) => {
  if (!isValidDate(value)) return true;
  return String(value) < todayKeyInManila();
};
