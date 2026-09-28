export const DEFAULT_SITE_URL = 'https://astraeacollection.vercel.app/';
export function publicSiteUrl(value = DEFAULT_SITE_URL) {
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
    if (url.hostname === 'localhost' || url.hostname.endsWith('.local') || !url.hostname.includes('.') || /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)) return null;
    return `${url.origin}/`;
  } catch { return null; }
}
