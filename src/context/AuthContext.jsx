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

      const { data: isAdmin, error } = await supabase.rpc('is_admin');
      setUser(!error && isAdmin ? session.user : null);
    };

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      await applySession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email, password) => {
    const result = await supabase.auth.signInWithPassword({ email, password });
    if (result.error) return result;

    const { data: isAdmin, error } = await supabase.rpc('is_admin');
    if (error || !isAdmin) {
      await supabase.auth.signOut();
      return { data: null, error: new Error('This user is not an administrator.') };
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
