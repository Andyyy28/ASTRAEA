import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, supabaseConfigReady } from '../lib/supabase';
import Skeleton from '../components/Skeleton';

const AuthContext = createContext();
const SESSION_LOAD_TIMEOUT_MS = 5000;
const ADMIN_CHECK_TIMEOUT_MS = 4000;
const DEFAULT_ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || 'admin@astraea.com';
const DEFAULT_ADMIN_PASSWORD = 'Super_Admin123!';

const withTimeout = (promise, timeoutMs, timeoutMessage) => {
  let timeoutId;

  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timeoutId));
};

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // Track whether the current session is a real Supabase session or a dev bypass
  const [isDevMode, setIsDevMode] = useState(false);

  useEffect(() => {
    const applySession = async (session) => {
      if (!session) {
        setUser(null);
        return;
      }

      // Check if user is in the admin_users table
      try {
        const { data: isAdmin, error } = await withTimeout(
          supabase.rpc('is_admin'),
          ADMIN_CHECK_TIMEOUT_MS,
          'Admin permission check timed out.'
        );
        if (error) {
          // If is_admin function doesn't exist yet (tables not set up),
          // fall back to just using the session user.
          if (error.code !== 'PGRST202') {
            console.warn('Unable to verify admin privileges from saved session:', error);
          }
          setUser(session.user);
        } else {
          setUser(isAdmin ? session.user : null);
        }
      } catch (error) {
        console.warn('Unable to verify admin privileges from saved session:', error);
        setUser(session.user);
      }
    };

    let mounted = true;

    const timeoutId = window.setTimeout(() => {
      if (!mounted) return;
      console.warn('Supabase session check timed out. Rendering public routes without an active session.');
      setUser(null);
      setLoading(false);
    }, SESSION_LOAD_TIMEOUT_MS);

    // Check active Supabase session. Public pages should still render if
    // Supabase is unreachable or misconfigured.
    if (!supabaseConfigReady) {
      console.warn('Supabase anon key is missing or invalid. Rendering the app without auth.');
      setUser(null);
      setLoading(false);
      return () => {};
    }

    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        await applySession(session);
      })
      .catch((error) => {
        console.warn('Unable to load Supabase session:', error);
        setUser(null);
      })
      .finally(() => {
        window.clearTimeout(timeoutId);
        if (mounted) setLoading(false);
      });

    // Listen for auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      await applySession(session);
    });

    return () => {
      mounted = false;
      window.clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email, password) => {
    // Step 1: Always try real Supabase Auth first (needed for JWT/Storage/RLS)
    let result = await supabase.auth.signInWithPassword({ email, password });

    // Step 2: If sign-in fails, try sign-up for the default admin account
    if (result.error && email === DEFAULT_ADMIN_EMAIL && password === DEFAULT_ADMIN_PASSWORD) {
      const errMsg = result.error.message?.toLowerCase() || '';
      const isRateLimit = errMsg.includes('rate limit') || errMsg.includes('too many');

      if (!isRateLimit) {
        // Try signing up (user might not exist yet)
        const signUpResult = await supabase.auth.signUp({ email, password });
        if (!signUpResult.error && signUpResult.data?.user) {
          if (signUpResult.data.session) {
            result = signUpResult;
          } else {
            // Email confirmation might be required — try signing in again
            result = await supabase.auth.signInWithPassword({ email, password });
          }
        }
      }
    }

    // Step 3: If real auth worked, verify admin status
    if (!result.error) {
      setIsDevMode(false);
      try {
        const { data: isAdmin, error } = await withTimeout(
          supabase.rpc('is_admin'),
          ADMIN_CHECK_TIMEOUT_MS,
          'Admin permission check timed out.'
        );
        if (error) {
          console.warn("RPC is_admin error:", error);
          if (error.code !== 'PGRST202') {
            setUser(result.data.user);
            return result;
          }
        } else if (!isAdmin) {
          await supabase.auth.signOut();
          return { data: null, error: new Error('Not an administrator. Add this user to admin_users table.') };
        }
      } catch (err) {
        console.warn("is_admin check exception:", err);
      }
      setUser(result.data.user);
      return result;
    }

    // Step 4: Optional local-only bypass. Storage uploads require a real Supabase
    // Auth session, so keep this disabled unless explicitly enabled for UI work.
    if (
      import.meta.env.VITE_ENABLE_DEV_ADMIN_BYPASS === 'true' &&
      email === DEFAULT_ADMIN_EMAIL &&
      password === DEFAULT_ADMIN_PASSWORD
    ) {
      console.warn("Real Supabase auth failed, using dev bypass. Storage uploads will NOT work.", result.error.message);
      const mockUser = { id: 'dev-admin-id', email: DEFAULT_ADMIN_EMAIL, role: 'authenticated' };
      setUser(mockUser);
      setIsDevMode(true);
      return { data: { user: mockUser }, error: null };
    }

    if (email === DEFAULT_ADMIN_EMAIL && password === DEFAULT_ADMIN_PASSWORD) {
      if (!supabaseConfigReady) {
        return {
          data: null,
          error: new Error(
            'Supabase anon key is missing or invalid in this deployment. Set VITE_SUPABASE_ANON_KEY in Vercel and redeploy.'
          )
        };
      }

      return {
        data: null,
        error: new Error(
          `Supabase Auth login failed: ${result.error.message}. Create or confirm the admin user in Supabase Auth, add it to public.admin_users, then sign in again.`
        )
      };
    }

    // Step 5: Not default admin creds and real auth failed
    return result;
  };

  const logout = async () => {
    setUser(null);
    setIsDevMode(false);
    return supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isDevMode }}>
      {loading ? (
        <div className="min-h-screen bg-astraea-cream flex flex-col">
          {/* Skeleton Navbar */}
          <header className="h-20 bg-white/80 border-b-2 border-dashed border-astraea-pink/30 flex items-center justify-between px-4 sm:px-10">
            <div className="flex items-center gap-2">
              <Skeleton className="w-8 h-8 rounded-full" />
              <Skeleton className="w-32 h-6" />
            </div>
            <div className="flex items-center gap-6">
              <Skeleton className="w-16 h-4 hidden sm:block" />
              <Skeleton className="w-16 h-4 hidden sm:block" />
              <Skeleton className="w-16 h-4 hidden sm:block" />
              <Skeleton className="w-10 h-10 rounded-full" />
            </div>
          </header>
          {/* Skeleton Page Body */}
          <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-8">
            <div className="text-center space-y-3">
              <Skeleton className="w-64 h-10 mx-auto" />
              <Skeleton className="w-96 h-5 mx-auto" />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white border-2 border-dashed border-[#F4BFCF] rounded-[20px] p-4 space-y-4 shadow-[4px_4px_0px_#F9A8C9]">
                  <Skeleton className="w-full aspect-[4/3] rounded-xl" />
                  <Skeleton className="w-2/3 h-5" />
                  <Skeleton className="w-1/3 h-6" />
                  <Skeleton className="w-full h-10 rounded-full" />
                </div>
              ))}
            </div>
          </main>
        </div>
      ) : children}
    </AuthContext.Provider>
  );
};
