const PUBLIC_KEYS = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_TURNSTILE_SITE_KEY'];

export function validatePublicEnv(env = process.env, { production = false } = {}) {
  const url = String(env.VITE_SUPABASE_URL || '').trim();
  const anonKey = String(env.VITE_SUPABASE_ANON_KEY || '').trim();
  const turnstileKey = String(env.VITE_TURNSTILE_SITE_KEY || '').trim();
  if (!/^https:\/\//i.test(url) && !/^http:\/\/localhost(?::\d+)?$/i.test(url) && !/^http:\/\/127\.0\.0\.1(?::\d+)?$/i.test(url)) {
    throw new Error('VITE_SUPABASE_URL must be an HTTPS URL (or localhost for development).');
  }
  if (!anonKey || /^your[_-]/i.test(anonKey) || /service[_-]?role|secret/i.test(anonKey)) {
    throw new Error('VITE_SUPABASE_ANON_KEY must be a public anonymous/publishable key.');
  }
  if (/^sb_secret_/i.test(anonKey)) throw new Error('VITE_SUPABASE_ANON_KEY cannot be a secret key.');
  if (/^eyJ/i.test(anonKey)) {
    try {
      const payload = JSON.parse(Buffer.from(anonKey.split('.')[1], 'base64url').toString('utf8'));
      if (payload.role !== 'anon') throw new Error('JWT role is not anon');
    } catch (error) {
      throw new Error(`VITE_SUPABASE_ANON_KEY is not a valid public JWT: ${error.message}`, { cause: error });
    }
  } else if (!/^sb_publishable_/i.test(anonKey)) {
    throw new Error('VITE_SUPABASE_ANON_KEY must be a Supabase publishable key or anon JWT.');
  }
  if (production && (!turnstileKey || /^your[_-]/i.test(turnstileKey))) {
    throw new Error('VITE_TURNSTILE_SITE_KEY must be configured for production builds.');
  }
  return { url, anonKey, turnstileKey, keys: PUBLIC_KEYS };
}

