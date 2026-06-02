import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Eye, EyeOff, Lock } from 'lucide-react';
import Skeleton from '../../components/Skeleton';

const AdminLogin = () => {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Auto-redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/admin');
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error: authError } = await login(email, password);
      if (authError) throw authError;
      // Login success is handled by the AuthContext observer
    } catch (err) {
      setError(err?.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-astraea-blush/30 flex items-center justify-center p-4">
      <div className="bg-white max-w-md w-full p-8 rounded-3xl shadow-xl border border-astraea-rosegold/20 animate-fade-in text-center">
        
        <div className="w-16 h-16 bg-astraea-blush rounded-full flex items-center justify-center mx-auto mb-6">
          <Lock className="w-8 h-8 text-astraea-pink" />
        </div>
        
        <h1 className="font-heading text-3xl font-bold text-astraea-pink mb-2">Astraea Collection</h1>
        <h2 className="text-astraea-darkgray/70 font-medium tracking-widest uppercase text-sm mb-8">Admin Panel</h2>

        {error && (
          <div className="mb-6 p-3 bg-red-50 text-red-600 rounded-lg text-sm font-medium text-left break-words">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 text-left" autoComplete="off">
          <div>
            <label className="block text-sm font-bold text-astraea-darkgray mb-2">Email Address</label>
            <input 
              type="email" 
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-astraea-rosegold/40 rounded-xl p-3 focus:ring-2 focus:ring-astraea-pink outline-none"
              placeholder="admin@astraea.com"
            />
          </div>
          
          <div className="relative">
            <label className="block text-sm font-bold text-astraea-darkgray mb-2">Password</label>
            <input 
              type={showPassword ? "text" : "password"} 
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-astraea-rosegold/40 rounded-xl p-3 pr-12 focus:ring-2 focus:ring-astraea-pink outline-none"
              placeholder="••••••••"
            />
            <button 
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-10 text-astraea-darkgray/40 hover:text-astraea-pink"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          <div className="flex gap-2">
            <button 
              type="submit"
              disabled={loading}
              className="flex-1 py-4 bg-astraea-pink text-white rounded-xl font-bold text-lg hover:bg-astraea-pink/90 transition-colors shadow-md disabled:opacity-70 flex justify-center"
            >
              {loading ? <Skeleton className="w-16 h-5 bg-white/30" /> : 'Login'}
            </button>

          </div>

        </form>
        
        <p className="text-xs text-astraea-darkgray/40 mt-8">
          Authorized personnel only. Contact system administrator for access.
        </p>
      </div>
    </div>
  );
};

export default AdminLogin;
