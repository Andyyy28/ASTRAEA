const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseProvisioningOptions(args, env) {
  const create = args.length === 1 && args[0] === '--create';
  const enroll = args.length === 2 && args[0] === '--user-id' && UUID.test(args[1]);
  if (!create && !enroll) throw new Error('Use --user-id <verified-auth-user-uuid> or --create. Password reset is not supported.');
  if (!env.VITE_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  const url = new URL(env.VITE_SUPABASE_URL);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) {
    throw new Error('Use an HTTPS Supabase URL, or a local development URL.');
  }
  if (create && (!env.ADMIN_EMAIL || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.ADMIN_EMAIL))) throw new Error('An explicit ADMIN_EMAIL is required for creation.');
  if (create && (typeof env.ADMIN_PASSWORD !== 'string' || env.ADMIN_PASSWORD.length < 20)) {
    throw new Error('Provide a unique randomly generated ADMIN_PASSWORD of at least 20 characters.');
  }
  return { create, userId: enroll ? args[1] : null, email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD };
}

export async function provisionAdmin(client, options) {
  const { error: preflightError } = await client.from('admin_users').select('user_id').limit(0);
  if (preflightError) throw new Error('Administrator enrollment is unavailable. Check database permissions before provisioning.');
  if (options.create) {
    const { data, error } = await client.auth.admin.createUser({ email: options.email, password: options.password, email_confirm: false });
    if (error || !data?.user?.id) throw new Error('Account creation failed. Existing accounts must be enrolled explicitly by UUID.');
    return { userId: data.user.id, enrolled: false, requiresVerification: true };
  }
  const { data, error } = await client.auth.admin.getUserById(options.userId);
  if (error || !data?.user) throw new Error('The selected Auth user could not be verified.');
  const user = data.user;
  if (user.id !== options.userId || !user.email_confirmed_at || user.is_anonymous) throw new Error('Only a verified, non-anonymous email account can be enrolled.');
  const { error: enrollmentError } = await client.from('admin_users').upsert({ user_id: user.id }, { onConflict: 'user_id' });
  if (enrollmentError) throw new Error('Administrator enrollment failed. No password or email verification was changed.');
  return { userId: user.id, enrolled: true, requiresVerification: false };
}
