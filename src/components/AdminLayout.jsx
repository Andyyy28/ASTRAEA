import React, { useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, ShoppingBag, Box, Flower2, CircleDollarSign, Settings, LogOut, Menu } from 'lucide-react';

const AdminLayout = () => {
  const { user, loading, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/admin/login');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#FCFAFB]"><div className="w-10 h-10 border-4 border-astraea-pink border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (!user) return null; // Will redirect

  const navItems = [
    { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
    { name: 'Orders', path: '/admin/orders', icon: ShoppingBag },
    { name: 'Inventory', path: '/admin/inventory', icon: Box },
    { name: 'Bouquets', path: '/admin/bouquets', icon: Flower2 },
    { name: 'Price List', path: '/admin/prices', icon: CircleDollarSign },
    { name: 'Settings', path: '/admin/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#FCFAFB] flex flex-col md:flex-row text-astraea-darkgray">
      
      {/* Sidebar (Desktop) */}
      <aside className="hidden md:flex flex-col w-72 bg-white/60 backdrop-blur-xl border-r border-astraea-pink/10 sticky top-0 h-screen">
        <div className="h-20 flex items-center px-8 border-b border-astraea-pink/10">
          <Link to="/" className="text-2xl font-extrabold tracking-tight text-astraea-pink flex items-center gap-2">
            <Flower2 className="w-6 h-6" /> Astraea Admin
          </Link>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-6">
          <ul className="space-y-2 px-4">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <li key={item.name}>
                  <Link
                    to={item.path}
                    className={`flex items-center px-4 py-3 rounded-2xl font-semibold transition-all duration-300 ${
                      isActive ? 'bg-astraea-pink/10 text-astraea-pink shadow-sm' : 'text-gray-500 hover:bg-white hover:text-astraea-darkgray hover:shadow-sm'
                    }`}
                  >
                    <item.icon className={`w-5 h-5 mr-4 ${isActive ? 'text-astraea-pink' : 'text-gray-400'}`} />
                    {item.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        
        <div className="p-6 border-t border-astraea-pink/10">
          <button 
            onClick={logout}
            className="flex items-center w-full px-4 py-3 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all duration-300 font-semibold"
          >
            <LogOut className="w-5 h-5 mr-4 text-gray-400" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Topbar (Mobile & Desktop) */}
        <header className="h-20 bg-[#FCFAFB]/80 backdrop-blur-xl border-b border-astraea-pink/5 flex items-center justify-between px-6 sm:px-10 z-10 sticky top-0">
          <div className="flex items-center md:hidden">
            {/* Mobile menu toggle would go here */}
            <Menu className="w-6 h-6 text-gray-500 mr-4" />
            <span className="text-xl font-bold tracking-tight text-astraea-pink">Astraea Admin</span>
          </div>
          
          <div className="hidden md:flex items-center">
            <h1 className="text-2xl font-bold text-astraea-darkgray capitalize tracking-tight">
              {navItems.find(i => i.path === location.pathname)?.name || 'Admin Panel'}
            </h1>
          </div>

          <div className="flex items-center">
            <div className="hidden sm:flex items-center bg-white/60 px-4 py-2 rounded-full shadow-sm border border-astraea-pink/10 mr-4">
              <div className="w-2 h-2 rounded-full bg-green-400 mr-2"></div>
              <span className="text-sm font-semibold text-gray-600">{user.email}</span>
            </div>
            <button onClick={logout} className="md:hidden text-gray-500 hover:text-red-500">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 sm:p-10 lg:p-12">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
