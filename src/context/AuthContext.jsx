import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const mockAdmin = localStorage.getItem('mockAdmin');
    if (mockAdmin) {
      setUser(JSON.parse(mockAdmin));
      setLoading(false);
      return;
    }

    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!localStorage.getItem('mockAdmin')) {
        setUser(session?.user ?? null);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!localStorage.getItem('mockAdmin')) {
        setUser(session?.user ?? null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email, password) => {
    if (email === 'admin@astraea.com' && password === 'astraea2024') {
      const mockUser = { id: 'admin-123', email: 'admin@astraea.com', role: 'admin' };
      localStorage.setItem('mockAdmin', JSON.stringify(mockUser));
      setUser(mockUser);
      return { data: { user: mockUser, session: {} }, error: null };
    }
    return supabase.auth.signInWithPassword({ email, password });
  };

  const logout = async () => {
    localStorage.removeItem('mockAdmin');
    setUser(null);
    return supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
