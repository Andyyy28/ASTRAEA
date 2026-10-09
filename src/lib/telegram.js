/**
 * Compatibility exports for existing checkout/review callers.
 * Notifications must originate from committed database events in the backend.
 * Deploy the worker and deferred outbox prerequisites before this frontend.
 * No payloads or credentials are transmitted by these exports.
 */
export async function sendOrderNotification() { return { status: 'client-disabled' }; }
export async function sendReviewNotification() { return { status: 'client-disabled' }; }
