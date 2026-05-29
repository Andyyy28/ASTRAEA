import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext();
const SESSION_LOAD_TIMEOUT_MS = 5000;
const ADMIN_CHECK_TIMEOUT_MS = 4000;

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
    if (result.error && email === 'admin@astraea.com' && password === 'astraea2024') {
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
      email === 'admin@astraea.com' &&
      password === 'astraea2024'
    ) {
      console.warn("Real Supabase auth failed, using dev bypass. Storage uploads will NOT work.", result.error.message);
      const mockUser = { id: 'dev-admin-id', email: 'admin@astraea.com', role: 'authenticated' };
      setUser(mockUser);
      setIsDevMode(true);
      return { data: { user: mockUser }, error: null };
    }

    if (email === 'admin@astraea.com' && password === 'astraea2024') {
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
        <div className="min-h-screen flex items-center justify-center bg-astraea-cream">
          <div className="w-10 h-10 border-4 border-astraea-pink border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : children}
    </AuthContext.Provider>
  );
};
