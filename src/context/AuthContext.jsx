import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const applySession = async (session) => {
      if (!session) {
        setUser(null);
        return;
      }

      // Check if user is in the admin_users table
      try {
        const { data: isAdmin, error } = await supabase.rpc('is_admin');
        setUser(!error && isAdmin ? session.user : null);
      } catch {
        // If is_admin RPC doesn't exist yet (tables not set up),
        // fall back to just using the session user
        setUser(session.user);
      }
    };

    // Check active Supabase session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      await applySession(session);
      setLoading(false);
    });

    // Listen for auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      await applySession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email, password) => {
    // Always use real Supabase Auth so the client gets a valid JWT token.
    // This is required for RLS policies that check auth.role() = 'authenticated'.
    let result = await supabase.auth.signInWithPassword({ email, password });
    
    // If sign-in fails because the user doesn't exist yet, try to sign them up
    // (only for the default admin account during initial setup)
    if (result.error && email === 'admin@astraea.com' && password === 'astraea2024') {
      const signUpResult = await supabase.auth.signUp({ email, password });
      if (!signUpResult.error && signUpResult.data?.user) {
        if (signUpResult.data.session) {
          result = signUpResult;
        } else {
          result = await supabase.auth.signInWithPassword({ email, password });
        }
      } else {
        return signUpResult;
      }
    }

    if (result.error) return result;

    // Verify admin status via the is_admin RPC
    try {
      const { data: isAdmin, error } = await supabase.rpc('is_admin');
      if (error || !isAdmin) {
        await supabase.auth.signOut();
        return { data: null, error: new Error('This user is not an administrator. Please add this user to the admin_users table.') };
      }
    } catch {
      // If is_admin RPC doesn't exist, allow login (tables not set up yet)
    }

    return result;
  };

  const logout = async () => {
    setUser(null);
    return supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
