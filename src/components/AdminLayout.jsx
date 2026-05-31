import React, { useEffect, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, ShoppingBag, Box, Flower2, Gift, MessageSquareText, Settings, LogOut, Menu, X } from 'lucide-react';

const AdminLayout = () => {
  const { user, loading, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? 'hidden' : '';
    document.body.style.position = isMobileMenuOpen ? 'fixed' : '';
    document.body.style.width = isMobileMenuOpen ? '100%' : '';

    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/admin/login');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-astraea-cream"><div className="w-10 h-10 border-4 border-astraea-pink border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (!user) return null; // Will redirect

  const navItems = [
    { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
    { name: 'Orders', path: '/admin/orders', icon: ShoppingBag },
    { name: 'Inventory', path: '/admin/inventory', icon: Box },
    { name: 'Bouquets', path: '/admin/bouquets', icon: Flower2 },
    { name: 'Other Products', path: '/admin/other-products', icon: Gift },
    { name: 'Reviews', path: '/admin/reviews', icon: MessageSquareText },
    { name: 'Settings', path: '/admin/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen md:h-screen bg-astraea-cream flex flex-col md:flex-row text-astraea-darkgray md:overflow-hidden">
      
      {/* Sidebar (Desktop) */}
      <aside className="hidden md:flex flex-col w-72 shrink-0 bg-astraea-blush/70 backdrop-blur-xl border-r-2 border-dashed border-astraea-pink md:sticky md:top-0 md:h-screen">
        <div className="h-20 flex items-center px-8 border-b border-dashed border-astraea-pink/30">
          <Link to="/" className="text-2xl font-extrabold tracking-tight text-astraea-darkgray flex items-center gap-2 rounded-full px-3 py-2 bg-white/80 shadow-[2px_2px_0px_#F9A8C9]">
            <Flower2 className="w-6 h-6 text-astraea-pink" /> Astraea Admin
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
                    className={`flex items-center px-4 py-3 rounded-full font-semibold transition-all duration-300 border-2 border-transparent ${
                      isActive ? 'bg-white text-astraea-pink border-astraea-pink shadow-[2px_2px_0px_#F9A8C9]' : 'text-astraea-darkgray hover:bg-white/70 hover:border-dashed hover:border-astraea-pink/50'
                    }`}
                  >
                    <item.icon className={`w-5 h-5 mr-4 ${isActive ? 'text-astraea-pink' : 'text-astraea-darkgray/50'}`} />
                    {item.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        
        <div className="p-6 border-t border-dashed border-astraea-pink/30">
          <button 
            onClick={logout}
            className="kawaii-btn kawaii-btn-outline w-full justify-start text-astraea-darkgray"
          >
            <LogOut className="w-5 h-5 mr-2 text-astraea-pink" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 md:h-screen md:min-h-0 md:overflow-hidden">
        
        {/* Topbar (Mobile & Desktop) */}
        <header className="h-16 md:h-20 bg-astraea-cream/85 backdrop-blur-xl border-b-2 border-dashed border-astraea-pink/30 flex items-center justify-between px-4 sm:px-10 z-10 sticky top-0">
          <div className="flex items-center md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="min-h-11 min-w-11 flex items-center justify-center text-astraea-darkgray mr-2 rounded-full bg-white/80 border border-dashed border-astraea-pink/40"
              aria-label="Open admin menu"
            >
              <Menu className="w-6 h-6" />
            </button>
            <span className="text-lg font-bold tracking-tight text-astraea-pink">✿ Astraea Admin</span>
          </div>
          
          <div className="hidden md:flex items-center">
            <h1 className="text-2xl font-bold text-astraea-darkgray capitalize tracking-tight">
              {navItems.find(i => i.path === location.pathname)?.name || 'Admin Panel'}
            </h1>
          </div>

          <div className="flex items-center">
            <div className="hidden sm:flex items-center bg-white/80 px-4 py-2 rounded-full shadow-[2px_2px_0px_#F9A8C9] border border-dashed border-astraea-pink/30 mr-4">
              <div className="w-2 h-2 rounded-full bg-green-400 mr-2"></div>
              <span className="text-sm font-semibold text-astraea-darkgray">{user.email}</span>
            </div>
            <button onClick={logout} className="md:hidden text-astraea-darkgray hover:text-red-500">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-8 lg:p-12 min-w-0 md:min-h-0 md:overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-astraea-cream md:hidden">
          <div className="h-16 px-4 flex items-center justify-between border-b-2 border-dashed border-astraea-pink/30">
            <Link to="/" onClick={() => setIsMobileMenuOpen(false)} className="text-xl font-extrabold tracking-tight text-astraea-darkgray flex items-center gap-2">
              <Flower2 className="w-6 h-6 text-astraea-pink" /> Astraea Admin
            </Link>
            <button onClick={() => setIsMobileMenuOpen(false)} className="min-h-11 min-w-11 flex items-center justify-center text-astraea-darkgray rounded-full bg-white/80 border border-dashed border-astraea-pink/40" aria-label="Close admin menu">
              <X className="w-6 h-6" />
            </button>
          </div>
          <nav className="h-[calc(100vh-4rem)] overflow-y-auto p-4">
            <ul className="space-y-2">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <li key={item.name}>
                    <Link
                      to={item.path}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`min-h-12 flex items-center px-4 py-3 rounded-full font-semibold border-2 border-transparent ${isActive ? 'bg-white text-astraea-pink border-astraea-pink shadow-[2px_2px_0px_#F9A8C9]' : 'text-astraea-darkgray'}`}
                    >
                      <item.icon className={`w-5 h-5 mr-4 ${isActive ? 'text-astraea-pink' : 'text-astraea-darkgray/50'}`} />
                      {item.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                logout();
              }}
              className="mt-6 kawaii-btn kawaii-btn-outline w-full justify-start text-astraea-darkgray"
            >
              <LogOut className="w-5 h-5 mr-2 text-astraea-pink" />
              Logout
            </button>
          </nav>
        </div>
      )}
    </div>
  );
};

export default AdminLayout;
