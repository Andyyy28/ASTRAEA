import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShoppingCart, Menu, X } from 'lucide-react';

import { useCart } from '../context/CartContext';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const { cartCount } = useCart();

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'Shop', path: '/shop' },
    { name: 'Customize', path: '/customize' },
    { name: 'Price List', path: '/price-list' },
    { name: 'Track Order', path: '/track-order' },
    { name: 'Contact', path: '/contact' },
  ];

  const isActive = (path) => {
    if (path === '/' && location.pathname !== '/') return false;
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="sticky top-0 z-50 bg-astraea-blush/95 backdrop-blur-md border-b-2 border-dashed border-astraea-pink shadow-[0_2px_0px_#F9A8C9] animate-fade-in transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 md:h-20">
          
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center">
            <Link to="/" className="font-heading text-xl sm:text-2xl md:text-3xl font-extrabold text-astraea-darkgray tracking-wide flex items-center gap-2 rounded-full px-3 py-2 hover:bg-white/70">
              <span className="text-astraea-pink">✿</span>
              Astraea Collection
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.path}
                className={`px-4 py-2 rounded-full text-sm font-bold transition-all hover:bg-white/80 hover:text-astraea-pink
                  ${isActive(link.path) ? 'bg-white text-astraea-pink shadow-[2px_2px_0px_#F9A8C9]' : 'text-astraea-darkgray'}`}
              >
                {link.name}
              </Link>
            ))}
          </div>

          {/* Cart Icon & Mobile Toggle */}
          <div className="flex items-center space-x-4">
            <Link to="/cart" className="relative min-h-11 min-w-11 p-2 flex items-center justify-center text-astraea-darkgray hover:text-astraea-pink transition-colors rounded-full bg-white/70 border border-dashed border-astraea-pink">
              <ShoppingCart className="h-6 w-6" />
              {cartCount > 0 && (
                <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-astraea-pink rounded-full border-2 border-white">
                  {cartCount}
                </span>
              )}
            </Link>
            
            {/* Mobile menu button */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="min-h-11 min-w-11 flex items-center justify-center text-astraea-darkgray hover:text-astraea-pink focus:outline-none"
                aria-label={isOpen ? 'Close menu' : 'Open menu'}
              >
                {isOpen ? <X className="h-7 w-7" /> : <Menu className="h-7 w-7" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      <div className={`md:hidden fixed inset-0 z-40 ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
        <div className={`absolute inset-0 bg-black/20 transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0'}`} onClick={() => setIsOpen(false)}></div>
        <div className={`absolute right-0 top-0 h-full w-full max-w-sm bg-astraea-cream border-l-2 border-dashed border-astraea-pink shadow-xl flex flex-col pt-20 px-6 space-y-2 transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          {navLinks.map((link) => (
            <Link
              key={link.name}
              to={link.path}
              onClick={() => setIsOpen(false)}
              className={`min-h-12 flex items-center text-lg font-bold border-b border-dashed border-astraea-pink/30 py-3 px-3 rounded-full
                ${isActive(link.path) ? 'bg-white text-astraea-pink shadow-[2px_2px_0px_#F9A8C9]' : 'text-astraea-darkgray'}`}
            >
              {link.name}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
