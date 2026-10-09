import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, supabaseConfigReady } from '../lib/supabase';
import { createAdminAuth } from '../lib/adminAuth';

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [controller] = useState(() => createAdminAuth(supabase, { configured: supabaseConfigReady }));
  const [auth, setAuth] = useState(() => controller.getState());
  useEffect(() => {
    const unsubscribe = controller.subscribe(setAuth);
    controller.start();
    return () => { unsubscribe(); controller.stop(); };
  }, [controller]);
  const login = (email, password) => controller.login(email, password);
  const logout = () => controller.logout();
  // Keep the login form/public routes mounted while verification is pending.
  // AdminLayout handles the loading state and never renders unverified content.
  return (
    <AuthContext.Provider value={{ ...auth, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
