import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const hasValidSupabaseUrl = typeof supabaseUrl === 'string' && (/^https:\/\/[A-Za-z0-9.-]+\.supabase\.co$/.test(supabaseUrl) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(supabaseUrl));
let hasValidSupabaseKey = typeof supabaseAnonKey === 'string' && supabaseAnonKey.length > 20 && !/^your[_-]/i.test(supabaseAnonKey) && !/service[_-]?role|secret/i.test(supabaseAnonKey);
if (hasValidSupabaseKey && /^eyJ/.test(supabaseAnonKey)) {
  try { hasValidSupabaseKey = JSON.parse(atob(supabaseAnonKey.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role === 'anon'; } catch { hasValidSupabaseKey = false; }
}
if (hasValidSupabaseKey && /^sb_secret_/i.test(supabaseAnonKey)) hasValidSupabaseKey = false;

const safeStorage = {
  getItem(key) { try { return localStorage.getItem(key); } catch { return null; } },
  setItem(key, value) { try { localStorage.setItem(key, value); } catch { /* storage is optional */ } },
  removeItem(key) { try { localStorage.removeItem(key); } catch { /* storage is optional */ } },
};

if (!hasValidSupabaseUrl || !hasValidSupabaseKey) {
  console.error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before deployment.');
}

export const supabase = createClient(hasValidSupabaseUrl ? supabaseUrl : 'https://missing-project.supabase.co', hasValidSupabaseKey ? supabaseAnonKey : 'missing-anon-key', {
  auth: { storage: safeStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});
export const supabaseConfigReady = hasValidSupabaseUrl && hasValidSupabaseKey;
