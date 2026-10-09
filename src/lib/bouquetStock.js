// Stock is authoritative only during the server quote/checkout transaction.
// This helper remains for read-only catalog badges and deliberately exposes no
// client-side reservation or release operation.
export const normalizeStock = (stock) => Math.max(0, Number(stock) || 0);
