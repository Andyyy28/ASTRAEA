import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://svldipwhfcguqsqlvhdt.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseAnonKey) {
  console.error('Missing VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and provide the Supabase anon key.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey || 'missing-anon-key');
