// Notifications must run server-side after a verified database event.
// Never embed bot tokens in VITE_ variables or send customer data from the browser.
export async function sendOrderNotification() { return false; }
export async function sendReviewNotification() { return false; }
