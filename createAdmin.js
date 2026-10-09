import { createClient } from '@supabase/supabase-js';
import { parseProvisioningOptions, provisionAdmin } from './scripts/adminProvisioning.js';

async function main() {
  const options = parseProvisioningOptions(process.argv.slice(2), process.env);
  const client = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const result = await provisionAdmin(client, options);
  if (result.enrolled) {
    console.log('Verified Auth user enrolled as an administrator. Credentials were not changed.');
  } else {
    console.log('Unverified account created without administrator access.');
    console.log('Complete email ownership verification using the Supabase invitation/confirmation workflow, then enroll its UUID with --user-id.');
  }
}
main().catch(() => {
  console.error('Provisioning failed. Verify explicit flags, configuration, email ownership, and enrollment permissions. No existing password is reset by this script.');
  process.exitCode = 1;
});
