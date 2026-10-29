/* global process */
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { validatePublicEnv } from './scripts/buildConfig.js'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const forbidden = Object.keys(env).filter((key) => /^VITE_.*(SERVICE|SECRET|TELEGRAM|PRIVATE|CLEANUP)/i.test(key));
  if (forbidden.length) throw new Error(`Refusing to expose server secrets through Vite: ${forbidden.join(', ')}`);
  const publicEnv = validatePublicEnv(env, { production: mode === 'production' });
  return {
    // No prefix wildcard: only these exact public values are defined below.
    envPrefix: [],
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(publicEnv.url),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(publicEnv.anonKey),
      'import.meta.env.VITE_TURNSTILE_SITE_KEY': JSON.stringify(publicEnv.turnstileKey),
    },
    plugins: [react()],
  };
})
