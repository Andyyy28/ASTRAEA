export class HttpError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}

export function jsonResponse(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  });
}

export async function readJson(request, maxBytes = 4096) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new HttpError(415, 'json_required');
  if (!request.body) throw new HttpError(400, 'invalid_request');
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new HttpError(413, 'request_too_large'); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!body || Array.isArray(body) || typeof body !== 'object') throw new Error('shape');
    return body;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'invalid_request');
  } finally { reader.releaseLock(); }
}

export function errorResponse(error, headers = {}) {
  return jsonResponse(error instanceof HttpError ? error.status : 503, {
    error: error instanceof HttpError ? error.code : 'service_unavailable',
  }, headers);
}

export function bearerToken(request) {
  const match = /^Bearer ([^\s]+)$/i.exec(request.headers.get('authorization') || '');
  if (!match || match[1].length > 8192) throw new HttpError(401, 'unauthorized');
  return match[1];
}

export async function secureEquals(value, expected) {
  const encode = new TextEncoder();
  const [a, b] = await Promise.all([value, expected].map(text => crypto.subtle.digest('SHA-256', encode.encode(text))));
  const first = new Uint8Array(a);
  const second = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < first.length; i++) diff |= first[i] ^ second[i];
  return diff === 0;
}
