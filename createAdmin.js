import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey || !adminEmail || !adminPassword) {
  console.error(
    "Missing VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL, or ADMIN_PASSWORD in .env"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const authClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const findUserByEmail = async (email) => {
  const perPage = 1000;
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const user = data.users.find((currentUser) => currentUser.email?.toLowerCase() === email.toLowerCase());
    if (user) return user;
    if (data.users.length < perPage) return null;

    page += 1;
  }
};

const verifyAdminLogin = async () => {
  const { error: signInError } = await authClient.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword
  });

  if (signInError) return false;

  const { data: isAdmin, error: rpcError } = await authClient.rpc('is_admin');
  await authClient.auth.signOut();

  return !rpcError && isAdmin === true;
};

async function createAdmin() {
  console.log("Attempting to create admin user...");

  let adminUser = await findUserByEmail(adminEmail);

  if (adminUser) {
    console.log(`Admin Auth user already exists: ${adminUser.id}`);

    const { data, error } = await supabase.auth.admin.updateUserById(adminUser.id, {
      password: adminPassword,
      email_confirm: true
    });

    if (error) throw error;
    adminUser = data.user;
    console.log("Admin Auth user password updated and email confirmed.");
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true
    });

    if (error) throw error;
    adminUser = data.user;
    console.log(`Admin Auth user created and email confirmed: ${adminUser.id}`);
  }

  const { error: adminError } = await supabase
    .from('admin_users')
    .upsert({ user_id: adminUser.id }, { onConflict: 'user_id' });

  if (adminError) {
    const message = adminError.message || '';
    if (message.includes("Could not find the table 'public.admin_users'")) {
      console.warn("Admin Auth user is ready, but public.admin_users does not exist yet.");
      console.warn("Run supabase/migrations/20260529_admin_permissions_fix.sql in the Supabase SQL Editor, then run this command again.");
      console.warn(`Admin user id: ${adminUser.id}`);
      return;
    }

    if (await verifyAdminLogin()) {
      console.log("Could not upsert public.admin_users directly, but the configured admin login is already enrolled.");
      console.log("Done. You can now sign in with the configured ADMIN_EMAIL and ADMIN_PASSWORD.");
      return;
    }

    throw adminError;
  }

  console.log("Admin user enrolled in public.admin_users.");
  console.log("Done. You can now sign in with the configured ADMIN_EMAIL and ADMIN_PASSWORD.");
}

createAdmin().catch((error) => {
  console.error("Failed to create admin:", error.message);
  process.exit(1);
});
