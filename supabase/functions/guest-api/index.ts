import { createClient } from 'npm:@supabase/supabase-js@2.106.1';
import { createGuestApiHandler } from '../_shared/guestApi.js';

Deno.serve(createGuestApiHandler({
  getEnv: (name: string) => Deno.env.get(name),
  createClient: () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000) }) },
  }),
}));
