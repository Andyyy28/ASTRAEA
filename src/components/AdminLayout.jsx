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
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="w-10 h-10 border-4 border-astraea-pink border-t-transparent rounded-full animate-spin"></div></div>;
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
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      
      {/* Sidebar (Desktop) */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200 sticky top-0 h-screen">
        <div className="h-16 flex items-center px-6 border-b border-gray-200">
          <Link to="/" className="font-heading text-xl font-bold text-astraea-pink">Astraea Admin</Link>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-3">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <li key={item.name}>
                  <Link
                    to={item.path}
                    className={`flex items-center px-3 py-2.5 rounded-lg font-medium transition-colors ${
                      isActive ? 'bg-astraea-pink text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <item.icon className={`w-5 h-5 mr-3 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                    {item.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        
        <div className="p-4 border-t border-gray-200">
          <button 
            onClick={logout}
            className="flex items-center w-full px-3 py-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium"
          >
            <LogOut className="w-5 h-5 mr-3 text-gray-400" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Topbar (Mobile & Desktop) */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6 z-10 sticky top-0">
          <div className="flex items-center md:hidden">
            {/* Mobile menu toggle would go here */}
            <Menu className="w-6 h-6 text-gray-500 mr-4" />
            <span className="font-heading text-lg font-bold text-astraea-pink">Astraea Admin</span>
          </div>
          
          <div className="hidden md:flex items-center">
            <h1 className="text-xl font-bold text-gray-800 capitalize">
              {navItems.find(i => i.path === location.pathname)?.name || 'Admin Panel'}
            </h1>
          </div>

          <div className="flex items-center">
            <span className="text-sm font-medium text-gray-500 mr-4 hidden sm:block">{user.email}</span>
            <button onClick={logout} className="md:hidden text-gray-500 hover:text-red-600">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
