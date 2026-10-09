import { createClient } from 'npm:@supabase/supabase-js@2.106.1';
import { createNotificationHandler } from '../_shared/notifications.js';

Deno.serve(createNotificationHandler({
  getEnv: (name: string) => Deno.env.get(name),
  createClient: () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000) }) },
  }),
}));
