import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function createAdmin() {
  console.log("Attempting to create admin user...");
  const { data, error } = await supabase.auth.signUp({
    email: 'admin@astraea.com',
    password: 'astraea2024',
  });

  if (error) {
    console.error("Error creating user:", error.message);
  } else {
    console.log("User creation response:", data);
    if (data?.user?.identities?.length === 0) {
      console.log("Note: This email might already be registered.");
    } else if (data?.session === null) {
      console.log("SUCCESS: User created! However, EMAIL CONFIRMATION IS ENABLED on your Supabase project.");
      console.log("We cannot confirm the email programmatically without a Service Role Key.");
    } else {
      console.log("SUCCESS: User created and logged in! Email confirmation is disabled.");
    }
  }
}

createAdmin();
