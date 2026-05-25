import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Lock, CheckCircle2 } from 'lucide-react';

const AdminSettings = () => {
  const { user } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password: password });
    
    if (updateError) {
      setError(updateError.message);
    } else {
      setMessage('Password updated successfully.');
      setPassword('');
      setConfirmPassword('');
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800">Account Settings</h1>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        
        <div className="p-6 border-b border-gray-200 bg-gray-50 flex items-center">
          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center border border-gray-200 mr-4 shadow-sm">
            <Lock className="w-6 h-6 text-astraea-pink" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-800">Update Password</h2>
            <p className="text-sm text-gray-500">Currently logged in as: <span className="font-medium text-gray-800">{user?.email}</span></p>
          </div>
        </div>

        <div className="p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 text-sm font-medium">
              {error}
            </div>
          )}
          
          {message && (
            <div className="mb-6 p-4 bg-green-50 text-green-700 rounded-xl border border-green-100 text-sm font-medium flex items-center">
              <CheckCircle2 className="w-5 h-5 mr-2" /> {message}
            </div>
          )}

          <form onSubmit={handleUpdatePassword} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">New Password</label>
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-astraea-pink outline-none"
                placeholder="Enter new password"
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Confirm New Password</label>
              <input 
                type="password" 
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-astraea-pink outline-none"
                placeholder="Confirm new password"
              />
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-astraea-pink text-white rounded-xl font-bold text-lg hover:bg-astraea-pink/90 transition-colors shadow-md disabled:opacity-70 flex justify-center"
            >
              {loading ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Update Password'}
            </button>
          </form>
        </div>
        
      </div>
    </div>
  );
};

export default AdminSettings;
