import { publicCatalog } from './publicCatalog';

export const customerRoutes = {
  '/': () => import('../pages/customer/Home'),
  '/shop': () => import('../pages/customer/Shop'),
  '/shop/:id': () => import('../pages/customer/ShopDetail'),
  '/customize': () => import('../pages/customer/Customize'),
  '/other-products': () => import('../pages/customer/OtherProducts'),
  '/other-products/:id': () => import('../pages/customer/OtherProductDetail'),
  '/cart': () => import('../pages/customer/Cart'),
  '/checkout': () => import('../pages/customer/Checkout'),
  '/track-order': () => import('../pages/customer/TrackOrder'),
  '/faq': () => import('../pages/customer/FAQ'),
  '/contact': () => import('../pages/customer/Contact'),
  '/share': () => import('../pages/customer/Share'),
};

const routeData = { '/': ['featured', 'reviews'], '/shop': ['bouquets'], '/other-products': ['products'] };
const prefetched = new Set();

// Start the next page's code and public data when a visitor points at a link,
// focuses it with the keyboard, or touches it. Respect constrained connections.
export function prefetchCustomerLink(event) {
  if (navigator.connection?.saveData || /(^|-)2g$/.test(navigator.connection?.effectiveType || '')) return;
  const anchor = event.target.closest?.('a[href]');
  if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
  const url = new URL(anchor.href);
  if (url.origin !== window.location.origin) return;
  const path = url.pathname.replace(/\/$/, '') || '/';
  if (path === window.location.pathname) return;
  const key = customerRoutes[path] ? path : /^\/shop\/[^/]+$/.test(path) ? '/shop/:id' : /^\/other-products\/[^/]+$/.test(path) ? '/other-products/:id' : null;
  if (!key) return;
  if (!prefetched.has(key)) {
    prefetched.add(key);
    customerRoutes[key]().catch(() => prefetched.delete(key));
  }
  routeData[path]?.forEach(name => { void publicCatalog[name].load(); });
}
